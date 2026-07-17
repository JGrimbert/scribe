import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
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
  StyleInventory,
  Trame,
  TrameNode,
} from '../import/odt-parser'
import { nodeContentHash } from '../analyse/plain-text'
import { collectShapes, StructureShapes } from '../analyse/structure-shapes'
import { DocumentTypology, isTypologySettled, suggestTypology, typologyErrors } from './typology'
import { DEFAULT_RULES, DocumentRules, normalizeRules, rulesErrors } from './rules'
import { PreviousValidation, RebuiltNode, remapValidations } from './recalibration'
import {
  CommitImportRequest,
  CommitResponse,
  DocumentContent,
  DocumentSummary,
  NodeValidationResponse,
  NodeValidationState,
  PreviewResponse,
  SaveTypologyRequest,
  TypologyResponse,
} from './dto'

const EMPTY_INVENTORY: StyleInventory = { styles: [], highlights: [] }

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Aperçu en attente de calibration, gardé en mémoire (process backend
  // mono-instance, usage local) le temps que l'utilisateur valide/corrige
  // la structure détectée. Perdu si le serveur redémarre entre-temps —
  // acceptable pour cet usage, pas de file d'attente multi-utilisateurs.
  // `documentId` présent = recalibration d'un document déjà en base (le buffer
  // vient de DocumentSource) plutôt qu'un premier import. Le commit s'y fie
  // pour remplacer au lieu de créer — un seul flux de calibration, deux
  // destinations.
  private readonly pendingImports = new Map<string, { buffer: Buffer; originalFilename: string; documentId?: string }>()

  async previewUpload(buffer: Buffer, originalFilename: string): Promise<PreviewResponse> {
    return this.openPreview(buffer, originalFilename)
  }

  // Rejouer la calibration d'un document existant, à partir du .odt conservé
  // (cf. DocumentSource). Rend exactement le même PreviewResponse qu'un import
  // neuf : côté frontend, c'est le même écran de calibration, avec les mêmes
  // suggestions recalculées depuis le fichier d'origine.
  async previewRecalibration(documentId: string): Promise<PreviewResponse> {
    const { bytes, filename } = await this.getSource(documentId)
    return this.openPreview(bytes, filename, documentId)
  }

  private async openPreview(buffer: Buffer, originalFilename: string, documentId?: string): Promise<PreviewResponse> {
    const { outline, suggestedStructureStartIndex, suggestedStructureEndIndex } =
      await parseOdtBufferForPreview(buffer)
    const previewId = randomUUID()
    this.pendingImports.set(previewId, { buffer, originalFilename, documentId })

    return { previewId, outline, suggestedStructureStartIndex, suggestedStructureEndIndex }
  }

  async commitImport(previewId: string, corrections: CommitImportRequest): Promise<CommitResponse> {
    const pending = this.pendingImports.get(previewId)
    if (!pending) throw new NotFoundException(`Aperçu ${previewId} introuvable ou expiré`)

    // Des bornes croisées ne produiraient pas une erreur mais un livre vide :
    // tout le corps partirait en liminaire ou en final, sans que rien ne le
    // signale. Refuser avant de consommer l'aperçu — sinon le buffer est perdu
    // et l'utilisateur doit re-téléverser son .odt pour corriger un lapsus.
    const { structureStartIndex, structureEndIndex } = corrections
    if (structureEndIndex != null && structureEndIndex <= structureStartIndex) {
      throw new BadRequestException(
        `La partie finale (index ${structureEndIndex}) doit commencer après le début de la structure (index ${structureStartIndex})`,
      )
    }

    this.pendingImports.delete(previewId)

    const { result, data, trame } = await parseOdtBuffer(pending.buffer, corrections as ImportCorrections)
    return pending.documentId
      ? this.replace(pending.documentId, result, data, trame)
      : this.persist(result, data, trame, pending.originalFilename, pending.buffer)
  }

  /**
   * Recalibrer : reconstruire l'arbre d'un document déjà en base, à partir du
   * même .odt et de corrections différentes.
   *
   * Ce qui est REMPLACÉ : les nœuds, les paragraphes, les relevés d'import
   * (inventaire, liminaire, final) et les totaux — c'est le parse qui les rend,
   * et il vient de rejouer.
   *
   * Ce qui SURVIT : le .odt (c'est le même fichier), la typologie des styles et
   * les règles d'éligibilité (des décisions de l'utilisateur, pas des
   * propriétés du parse — et `settled` se recalcule tout seul contre le nouvel
   * inventaire, cf. typology.ts), et les validations manuelles, réapposées par
   * ré-appariement (cf. recalibration.ts).
   *
   * Ce qui est JETÉ : les analyses NLP. Elles indexent des nodeId, or
   * `harmonize()` en regénère de neufs à chaque parse — les garder, ce serait
   * afficher un dashboard qui parle de nœuds qui n'existent plus. Le cache
   * d'embeddings étant adressé par contenu, le recalcul du volet sémantique ne
   * revectorise rien de déjà vu.
   */
  private async replace(
    documentId: string,
    result: ParsedResult,
    data: DataMap,
    trame: Trame,
  ): Promise<CommitResponse> {
    // Relevé AVANT destruction : le hash courant identifie le nœud, le hash
    // stocké porte l'état (validé/périmé) qu'on veut préserver.
    const existing = await this.prisma.node.findMany({
      where: { documentId, validation: { isNot: null } },
      select: {
        slug: true,
        validation: { select: { contentHash: true, validatedAt: true } },
        paragraphs: { orderBy: { position: 'asc' }, select: { type: true, ordered: true, content: true, styleName: true, highlight: true } },
      },
    })

    const previous: PreviousValidation[] = existing.map((node) => ({
      slug: node.slug,
      currentHash: nodeContentHash(this.texteOf(node.paragraphs)),
      storedHash: node.validation!.contentHash,
      validatedAt: node.validation!.validatedAt,
    }))

    const { nodeRows, paragraphRows } = this.buildRows(data, trame, documentId)
    const next: RebuiltNode[] = nodeRows.map((row) => ({
      nodeId: row.id as string,
      slug: row.slug,
      currentHash: nodeContentHash(data[row.id as string].texte),
    }))
    const { restore, dropped } = remapValidations(previous, next)

    const document = await this.prisma.$transaction(
      async (tx) => {
        // Cascade : les paragraphes ET les validations tombent avec les nœuds.
        // C'est pourquoi `restore` a été calculé avant.
        await tx.node.deleteMany({ where: { documentId } })

        const doc = await tx.document.update({
          where: { id: documentId },
          data: {
            title: result.meta.titreLivre || undefined,
            totalAxes: result.meta.totalAxes,
            totalBlocs: result.meta.totalBlocs,
            totalArticles: result.meta.totalArticles,
            totalMots: result.axes.reduce((s, a) => s + (a.stats?.mots || 0), 0),
            totalCaracteres: result.axes.reduce((s, a) => s + (a.stats?.caracteres || 0), 0),
            styleInventory: result.inventory as unknown as Prisma.InputJsonValue,
            liminaire: result.liminaire as unknown as Prisma.InputJsonValue,
            final: result.final as unknown as Prisma.InputJsonValue,
          },
        })

        await tx.node.createMany({ data: nodeRows })
        await tx.paragraph.createMany({ data: paragraphRows })
        if (restore.length) {
          await tx.nodeValidation.createMany({
            data: restore.map((r) => ({ nodeId: r.nodeId, contentHash: r.contentHash, validatedAt: r.validatedAt })),
          })
        }

        // Volets rendus caducs par les nouveaux ids. deleteMany et non un
        // update à null : la ligne entière n'a plus rien de valide, et
        // l'AnalyseService la recrée à la demande.
        await tx.documentAnalysis.deleteMany({ where: { documentId } })

        return doc
      },
      // Le défaut (5 s) ne suffit pas : un gros document, c'est ~900 nœuds et
      // ~3000 paragraphes à supprimer puis réécrire dans la même transaction.
      { timeout: 60_000 },
    )

    return {
      ...this.toSummary(document),
      recalibration: { restoredValidations: restore.length, droppedValidations: dropped },
    }
  }

  private async persist(
    result: ParsedResult,
    data: DataMap,
    trame: Trame,
    originalFilename: string,
    source: Buffer,
  ): Promise<DocumentSummary> {
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
          // Relevés d'import, lus en bloc : l'inventaire, et les deux bouts du
          // livre qui ne deviennent pas des Node. Le .odt est désormais
          // conservé (cf. DocumentSource), donc reconstructibles — mais les
          // recalculer à chaque lecture reviendrait à reparser le ZIP pour
          // afficher un tableau.
          styleInventory: result.inventory as unknown as Prisma.InputJsonValue,
          liminaire: result.liminaire as unknown as Prisma.InputJsonValue,
          final: result.final as unknown as Prisma.InputJsonValue,
          // Prisma rend les `Bytes` en Uint8Array, pas en Buffer (v6) : la
          // conversion est un aller-retour de type, pas une transformation.
          source: { create: { bytes: new Uint8Array(source), sizeBytes: source.length } },
        },
      })

      const { nodeRows, paragraphRows } = this.buildRows(data, trame, doc.id)
      await tx.node.createMany({ data: nodeRows })
      await tx.paragraph.createMany({ data: paragraphRows })

      return doc
    })

    return this.toSummary(document)
  }

  // L'arbre → deux tableaux de lignes, prêts pour un createMany. Partagé par
  // l'import initial et la recalibration : deux façons d'écrire les mêmes nœuds
  // finiraient par diverger sur un détail (une colonne oubliée d'un côté).
  //
  // Ids déjà stables (harmonize), parentId/position en colonnes : on aplatit
  // l'arbre plutôt que de faire un create par nœud. DFS pré-ordre → chaque
  // parent précède ses enfants dans nodeRows, donc la FK auto-référente
  // Node.parentId est satisfaite ligne à ligne. Évite la cascade d'allers-
  // retours qui dépassait le timeout de transaction Prisma (5 s) sur un gros
  // document.
  private buildRows(
    data: DataMap,
    trame: Trame,
    documentId: string,
  ): { nodeRows: Prisma.NodeCreateManyInput[]; paragraphRows: Prisma.ParagraphCreateManyInput[] } {
    const nodeRows: Prisma.NodeCreateManyInput[] = []
    const paragraphRows: Prisma.ParagraphCreateManyInput[] = []

    const collect = (node: TrameNode, parentId: string | null, position: number) => {
      const item = data[node.id]
      nodeRows.push({
        id: item.id,
        documentId,
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
        paragraphRows.push({
          nodeId: item.id,
          position: i,
          styleName: entry.styleName ?? null,
          highlight: entry.highlight ?? null,
          ...(entry.type === 'list'
            ? { type: 'LIST' as const, ordered: entry.ordered, content: JSON.stringify(entry.items) }
            : { type: 'TEXT' as const, content: entry.text }),
        }),
      )
      node.children.forEach((child, i) => collect(child, node.id, i))
    }

    trame.axes.forEach((axe, i) => collect(axe, null, i))
    return { nodeRows, paragraphRows }
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
  private texteOf(
    paragraphs: { type: string; ordered: boolean | null; content: string; styleName?: string | null; highlight?: string | null }[],
  ): HarmonizedItem['texte'] {
    return paragraphs.map((p): HarmonizedItem['texte'][number] => {
      const style = { styleName: p.styleName ?? undefined, highlight: p.highlight ?? null }
      return p.type === 'LIST'
        ? { type: 'list', ordered: p.ordered ?? false, items: JSON.parse(p.content), ...style }
        : { type: 'paragraph', text: p.content, ...style }
    })
  }

  // ─── Formes structurelles ───────────────────────────────────────────────

  // Dérivé, calculé à la volée, jamais persisté (cf. structure-shapes.ts).
  // Passe par getContent : reconstruire l'arbre ici, ce serait une seconde
  // lecture de la même chose, vouée à diverger de la première.
  async getStructureShapes(id: string): Promise<StructureShapes> {
    const { trame, data } = await this.getContent(id)
    return collectShapes(trame, data)
  }

  // ─── Typologie des styles ───────────────────────────────────────────────

  async getTypology(id: string): Promise<TypologyResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { styleInventory: true, styleTypology: true },
    })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)

    // Inventaire absent = document importé avant que le parseur ne relève les
    // styles. Le .odt n'étant pas conservé, il n'y a rien à rattraper : seule
    // une réimportation le remplira.
    const inventory = (document.styleInventory as unknown as StyleInventory | null) ?? EMPTY_INVENTORY
    const typology = document.styleTypology as unknown as DocumentTypology | null

    return {
      inventory,
      typology,
      suggested: suggestTypology(inventory),
      settled: isTypologySettled(typology, inventory),
    }
  }

  async saveTypology(id: string, body: SaveTypologyRequest): Promise<TypologyResponse> {
    const document = await this.prisma.document.findUnique({ where: { id }, select: { styleInventory: true } })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)

    const inventory = (document.styleInventory as unknown as StyleInventory | null) ?? EMPTY_INVENTORY
    const errors = typologyErrors(body, inventory)
    if (errors.length) throw new BadRequestException(errors)

    await this.prisma.document.update({
      where: { id },
      data: { styleTypology: body as unknown as Prisma.InputJsonValue },
    })
    return this.getTypology(id)
  }

  // ─── Règles d'éligibilité ───────────────────────────────────────────────

  // Typologie + règles en une lecture : AnalyseService a besoin des deux
  // ensemble pour juger la conformité, et elles vivent sur la même ligne.
  async getRuleContext(id: string): Promise<{ typology: DocumentTypology | null; rules: DocumentRules }> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { styleTypology: true, styleInventory: true, validationRules: true },
    })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)

    const inventory = (document.styleInventory as unknown as StyleInventory | null) ?? EMPTY_INVENTORY
    const typology = document.styleTypology as unknown as DocumentTypology | null
    return {
      // Une typologie à moitié remplie ne permet pas de juger : mieux vaut se
      // taire (available: false) que rendre un verdict sur des styles non
      // arbitrés.
      typology: isTypologySettled(typology, inventory) ? typology : null,
      // Règles jamais configurées = les défauts s'appliquent (normalizeRules
      // rend les défauts pour un null) : le dashboard dit quelque chose d'utile
      // sans qu'on ait rien eu à régler. La normalisation remonte aussi le
      // format historique à plat.
      rules: normalizeRules(document.validationRules),
    }
  }

  async getRules(id: string): Promise<DocumentRules> {
    const document = await this.prisma.document.findUnique({ where: { id }, select: { validationRules: true } })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)
    // Normalisé et pas rendu brut : la colonne peut porter le format historique
    // à plat (documents configurés avant les règles par profondeur), que le
    // client ne sait plus lire. normalizeRules rend les défauts pour un null.
    return normalizeRules(document.validationRules)
  }

  async saveRules(id: string, body: Partial<DocumentRules>): Promise<DocumentRules> {
    const document = await this.prisma.document.findUnique({ where: { id }, select: { id: true } })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)

    const errors = rulesErrors(body)
    if (errors.length) throw new BadRequestException(errors)

    const rules = normalizeRules(body)
    await this.prisma.document.update({
      where: { id },
      data: { validationRules: rules as unknown as Prisma.InputJsonValue },
    })
    return rules
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

  // Le .odt d'origine. Le `select` explicite sur la relation est tout le
  // propos de la table à part (cf. schema.prisma) : le blob ne remonte que
  // quand on le demande.
  async getSource(id: string): Promise<{ bytes: Buffer; filename: string }> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { sourceFilename: true, source: { select: { bytes: true } } },
    })
    if (!document) throw new NotFoundException(`Document ${id} introuvable`)
    // Distinct d'un document inexistant : celui-ci est bien là, c'est son
    // source qui manque (importé avant que le .odt ne soit conservé). Seul un
    // réimport le rattache — d'où un message qui le dit, plutôt qu'un 404 nu
    // qui laisserait croire à une erreur d'id.
    if (!document.source) {
      throw new NotFoundException(
        `Le .odt du document ${id} n'a pas été conservé (importé avant que le source ne le soit) : seul un réimport le rattache`,
      )
    }
    // Buffer et non Uint8Array : c'est ce qu'attend le parseur (unzipper).
    return { bytes: Buffer.from(document.source.bytes), filename: document.sourceFilename }
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
