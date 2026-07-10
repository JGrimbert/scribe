import { Injectable, NotFoundException } from '@nestjs/common'
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
import { CommitImportRequest, DocumentContent, DocumentSummary, PreviewResponse } from './dto'

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

      const createNode = (item: HarmonizedItem, parentId: string | null, position: number) =>
        tx.node.create({
          data: {
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
            paragraphs: {
              create: item.texte.map((content, i) => ({ position: i, content })),
            },
          },
        })

      async function createTree(node: TrameNode, parentId: string | null, position: number) {
        await createNode(data[node.id], parentId, position)
        for (let i = 0; i < node.children.length; i++) {
          await createTree(node.children[i], node.id, i)
        }
      }

      for (let axeIndex = 0; axeIndex < trame.axes.length; axeIndex++) {
        await createTree(trame.axes[axeIndex], null, axeIndex)
      }

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
        texte: node.paragraphs.map((p) => p.content),
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

    return { trame: { axes }, data }
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
