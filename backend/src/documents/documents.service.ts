import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import {
  parseOdtBuffer,
  parseOdtBufferForPreview,
  DataMap,
  HarmonizedItem,
  ImportCorrections,
  ParsedResult,
  Trame,
  TrameNode,
} from '../import/odt-parser'
import { nodeContentHash } from '../analyse/plain-text'
import {
  CommitImportRequest,
  DocumentContent,
  DocumentSummary,
  NodeValidationResponse,
  NodeValidationState,
  PreviewResponse,
} from './dto'

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Aperçu en attente de calibration, gardé en mémoire (process backend
  // mono-instance, usage local) le temps que l'utilisateur valide/corrige
  // la structure détectée. Perdu si le serveur redémarre entre-temps —
  // acceptable pour cet usage, pas de file d'attente multi-utilisateurs.
  private readonly pendingImports = new Map<string, { buffer: Buffer; originalFilename: string }>()

  async previewUpload(buffer: Buffer, originalFilename: string): Promise<PreviewResponse> {
    const { outline, suggestedStructureStartIndex } = await parseOdtBufferForPreview(buffer)
    const previewId = randomUUID()
    this.pendingImports.set(previewId, { buffer, originalFilename })

    return { previewId, outline, suggestedStructureStartIndex }
  }

  async commitImport(previewId: string, corrections: CommitImportRequest): Promise<DocumentSummary> {
    const pending = this.pendingImports.get(previewId)
    if (!pending) throw new NotFoundException(`Aperçu ${previewId} introuvable ou expiré`)
    this.pendingImports.delete(previewId)

    const { result, data, trame } = await parseOdtBuffer(pending.buffer, corrections as ImportCorrections)
    return this.persist(result, data, trame, pending.originalFilename)
  }

  private async persist(result: ParsedResult, data: DataMap, trame: Trame, originalFilename: string): Promise<DocumentSummary> {
    const title = result.meta.titreLivre || originalFilename.replace(/\.odt$/i, '')
    const totalMots = result.axes.reduce((s, a) => s + (a.stats?.mots || 0), 0)
    const totalCaracteres = result.axes.reduce((s, a) => s + (a.stats?.caracteres || 0), 0)

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          title,
          sourceFilename: originalFilename,
          totalAxes: result.meta.totalAxes,
          totalBlocs: result.meta.totalBlocs,
          totalArticles: result.meta.totalArticles,
          totalMots,
          totalCaracteres,
        },
      })

      // Ids déjà stables (harmonize), parentId/position en colonnes : on aplatit
      // l'arbre en deux tableaux et on insère en deux createMany plutôt qu'un
      // create par nœud. DFS pré-ordre → chaque parent précède ses enfants dans
      // nodeRows, donc la FK auto-référente Node.parentId est satisfaite ligne à
      // ligne. Évite la cascade d'allers-retours qui dépassait le timeout de
      // transaction Prisma (5 s) sur un gros document.
      const nodeRows: Prisma.NodeCreateManyInput[] = []
      const paragraphRows: Prisma.ParagraphCreateManyInput[] = []

      const collect = (node: TrameNode, parentId: string | null, position: number) => {
        const item = data[node.id]
        nodeRows.push({
          id: item.id,
          documentId: doc.id,
          level: item.level,
          parentId,
          position,
          titre: item.titre,
          slug: item.slug,
          indexGlobal: item.indexGlobal,
          connexe: item.connexe ?? undefined,
          mots: item.stats?.mots ?? null,
          caracteres: item.stats?.caracteres ?? null,
        })
        item.texte.forEach((entry, i) =>
          paragraphRows.push(
            entry.type === 'list'
              ? { nodeId: item.id, position: i, type: 'LIST', ordered: entry.ordered, content: JSON.stringify(entry.items) }
              : { nodeId: item.id, position: i, type: 'TEXT', content: entry.text },
          ),
        )
        node.children.forEach((child, i) => collect(child, node.id, i))
      }

      trame.axes.forEach((axe, i) => collect(axe, null, i))

      await tx.node.createMany({ data: nodeRows })
      await tx.paragraph.createMany({ data: paragraphRows })

      return doc
    })

    return this.toSummary(document)
  }

  async list(): Promise<DocumentSummary[]> {
    const documents = await this.prisma.document.findMany({ orderBy: { importedAt: 'desc' } })
    return documents.map((d) => this.toSummary(d))
  }

  async getContent(id: string): Promise<DocumentContent> {
    const document = await this.prisma.document.findUnique({ where: { id } })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)

    const nodes = await this.prisma.node.findMany({
      where: { documentId: id },
      orderBy: { position: 'asc' },
      include: { paragraphs: { orderBy: { position: 'asc' } } },
    })

    const data: DataMap = {}
    const childrenByParent = new Map<string | null, typeof nodes>()

    for (const node of nodes) {
      data[node.id] = {
        id: node.id,
        level: node.level,
        titre: node.titre,
        slug: node.slug,
        texte: this.texteOf(node.paragraphs),
        connexe: (node.connexe as HarmonizedItem['connexe']) ?? null,
        indexGlobal: node.indexGlobal,
        stats: node.mots != null ? { mots: node.mots, caracteres: node.caracteres ?? 0 } : null,
      }

      const siblings = childrenByParent.get(node.parentId) ?? []
      siblings.push(node)
      childrenByParent.set(node.parentId, siblings)
    }

    const buildTree = (nodeId: string): TrameNode => ({
      id: nodeId,
      children: (childrenByParent.get(nodeId) ?? []).map((child) => buildTree(child.id)),
    })

    const axes = (childrenByParent.get(null) ?? []).map((axe) => buildTree(axe.id))

    const validations: Record<string, NodeValidationState> = {}
    for (const [nodeId, hash] of await this.getValidations(id)) {
      const item = data[nodeId]
      if (!item) continue // validation orpheline (nœud disparu) : ignorée, la cascade la nettoiera
      validations[nodeId] = hash === nodeContentHash(item.texte) ? 'validé' : 'périmé'
    }

    return { title: document.title, trame: { axes }, data, validations }
  }

  // Paragraphes en base → `texte[]` du modèle. Partagé par getContent et la
  // validation : les deux doivent voir EXACTEMENT le même texte, sans quoi une
  // validation naîtrait périmée.
  private texteOf(paragraphs: { type: string; ordered: boolean | null; content: string }[]): HarmonizedItem['texte'] {
    return paragraphs.map((p): HarmonizedItem['texte'][number] =>
      p.type === 'LIST'
        ? { type: 'list', ordered: p.ordered ?? false, items: JSON.parse(p.content) }
        : { type: 'paragraph', text: p.content },
    )
  }

  // nodeId → contentHash au moment de la validation. Consommé aussi par
  // AnalyseService (complétude) : c'est la même vérité, chargée une fois.
  async getValidations(documentId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.nodeValidation.findMany({
      where: { node: { documentId } },
      select: { nodeId: true, contentHash: true },
    })
    return new Map(rows.map((r) => [r.nodeId, r.contentHash]))
  }

  // Valider = « j'ai relu ce chapitre dans cet état ». Rejouer l'opération sur
  // un chapitre périmé rafraîchit l'empreinte : c'est la revalidation.
  async validateNode(documentId: string, nodeId: string): Promise<NodeValidationResponse> {
    const node = await this.prisma.node.findFirst({
      where: { id: nodeId, documentId },
      include: { paragraphs: { orderBy: { position: 'asc' } } },
    })
    if (!node) throw new NotFoundException(`Nœud ${nodeId} introuvable dans le document ${documentId}`)

    const contentHash = nodeContentHash(this.texteOf(node.paragraphs))
    const saved = await this.prisma.nodeValidation.upsert({
      where: { nodeId },
      create: { nodeId, contentHash },
      update: { contentHash, validatedAt: new Date() },
    })
    return { nodeId, state: 'validé', validatedAt: saved.validatedAt.toISOString() }
  }

  // Idempotent : dévalider ce qui ne l'est pas n'est pas une erreur.
  async unvalidateNode(documentId: string, nodeId: string): Promise<void> {
    const node = await this.prisma.node.findFirst({ where: { id: nodeId, documentId } })
    if (!node) throw new NotFoundException(`Nœud ${nodeId} introuvable dans le document ${documentId}`)
    await this.prisma.nodeValidation.deleteMany({ where: { nodeId } })
  }

  async remove(id: string): Promise<void> {
    const document = await this.prisma.document.findUnique({ where: { id } })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)

    // Cascade Prisma (onDelete: Cascade sur Node.documentId et
    // Paragraph.nodeId, cf. schema.prisma) : supprimer le Document suffit à
    // supprimer tous ses nœuds/paragraphes.
    await this.prisma.document.delete({ where: { id } })
  }

  private toSummary(document: {
    id: string
    title: string
    sourceFilename: string
    importedAt: Date
    totalAxes: number
    totalBlocs: number
    totalArticles: number
    totalMots: number
    totalCaracteres: number
  }): DocumentSummary {
    return {
      id: document.id,
      title: document.title,
      sourceFilename: document.sourceFilename,
      importedAt: document.importedAt.toISOString(),
      totalAxes: document.totalAxes,
      totalBlocs: document.totalBlocs,
      totalArticles: document.totalArticles,
      totalMots: document.totalMots,
      totalCaracteres: document.totalCaracteres,
    }
  }
}
