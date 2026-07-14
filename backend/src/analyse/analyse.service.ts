import { createHash } from 'crypto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { DocumentsService } from '../documents/documents.service'
import { TrameNode } from '../import/odt-parser'
import { plainNodeText, plainParagraphTexts } from './plain-text'
import { buildSegments } from './segmentation'
import { assessCompleteness, stubNodeIds } from './completeness'
import { NlpClientService, NlpTopicsResult } from './nlp-client.service'
import { dot, meanNormalized } from './vector-math'
import {
  DocumentAnalysisResponse,
  LexicalAnalysis,
  SemanticAnalysis,
  SemanticUnit,
  TopicsAnalysis,
  TopicsJobStatusResponse,
} from './dto'

// Lots d'embeddings : assez petits pour que chaque appel HTTP au service
// Python reste sous les timeouts (undici coupe à 5 min sans en-têtes), assez
// gros pour amortir le batching du modèle.
const EMBED_BATCH_SIZE = 64
const CACHE_QUERY_CHUNK = 500
const NEIGHBORS_K = 8
const MIN_TOPIC_SEGMENTS = 20
const TOPIC_LABEL_WORDS = 4
// En deçà, un nœud n'a pas de représentation sémantique fiable (constaté sur
// manuscrit réel : des nœuds réduits à « I. » ou à une épigraphe dupliquée
// saturaient les paires à 100 %) — exclu de l'analyse plutôt que bruité.
const MIN_SEMANTIC_WORDS = 15

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

@Injectable()
export class AnalyseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly nlpClient: NlpClientService,
  ) {}

  async recomputeLexical(documentId: string): Promise<DocumentAnalysisResponse> {
    const { data } = await this.documentsService.getContent(documentId)
    const items = Object.values(data)

    const units = items
      .map((item) => ({ id: item.id, text: plainNodeText(item.texte) }))
      .filter((unit) => unit.text.trim().length > 0)

    const raw = await this.nlpClient.lexical(units)

    const titreById = new Map(items.map((item) => [item.id, item.titre]))
    const titre = (id: string) => titreById.get(id) ?? '(sans titre)'

    const lexical: LexicalAnalysis = {
      computedAt: new Date().toISOString(),
      model: raw.model,
      global: raw.global,
      units: raw.units.map(({ id, ...stats }) => ({ nodeId: id, titre: titre(id), ...stats })),
      entities: raw.entities.map(({ units: entityUnits, ...entity }) => ({
        ...entity,
        nodes: entityUnits.map((u) => ({ nodeId: u.id, titre: titre(u.id), count: u.count })),
      })),
      graph: raw.graph,
      lemmas: raw.lemmas.map(({ nodes, ...lemma }) => ({
        ...lemma,
        nodes: nodes.map((n) => ({ nodeId: n.id, titre: titre(n.id), count: n.count })),
      })),
    }

    const lexicalJson = lexical as unknown as Prisma.InputJsonValue
    await this.prisma.documentAnalysis.upsert({
      where: { documentId },
      create: { documentId, lexical: lexicalJson, lexicalComputedAt: new Date() },
      update: { lexical: lexicalJson, lexicalComputedAt: new Date() },
    })

    return this.get(documentId)
  }

  async recomputeSemantic(documentId: string): Promise<DocumentAnalysisResponse> {
    const { data } = await this.documentsService.getContent(documentId)

    // Le nom du modèle sert de clé de cache — demandé au service avant tout,
    // ce qui vérifie au passage qu'il est joignable.
    const model = (await this.nlpClient.health()).embeddings.model

    const uniqueTexts = new Map<string, string>()
    const nodes = Object.values(data)
      .map((item) => ({ item, texts: plainParagraphTexts(item.texte) }))
      .filter(
        ({ texts }) =>
          texts.join(' ').split(/\s+/).filter(Boolean).length >= MIN_SEMANTIC_WORDS,
      )
      .map(({ item, texts }) => ({
        id: item.id,
        titre: item.titre,
        hashes: texts.map((text) => {
          const hash = createHash('sha256').update(text).digest('hex')
          uniqueTexts.set(hash, text)
          return hash
        }),
      }))

    const vectorByHash = await this.resolveEmbeddings(model, uniqueTexts)

    const nodeVectors = nodes.map((node) =>
      meanNormalized(node.hashes.map((hash) => vectorByHash.get(hash)!)),
    )

    const units: SemanticUnit[] = nodes.map((node, i) => {
      const scores = nodes
        .map((other, j) => ({ nodeId: other.id, score: i === j ? -1 : dot(nodeVectors[i], nodeVectors[j]) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, NEIGHBORS_K)
        .map((n) => ({ nodeId: n.nodeId, score: Math.round(n.score * 10000) / 10000 }))
      return { nodeId: node.id, titre: node.titre, paragraphs: node.hashes.length, neighbors: scores }
    })

    const semantic: SemanticAnalysis = {
      computedAt: new Date().toISOString(),
      model,
      dimensions: nodeVectors[0]?.length ?? 0,
      units,
    }

    const semanticJson = semantic as unknown as Prisma.InputJsonValue
    await this.prisma.documentAnalysis.upsert({
      where: { documentId },
      create: { documentId, semantic: semanticJson, semanticComputedAt: new Date() },
      update: { semantic: semanticJson, semanticComputedAt: new Date() },
    })

    return this.get(documentId)
  }

  // Embeddings des textes, via le cache adressé par contenu : seuls les
  // textes jamais vus (pour ce modèle) partent vers le service Python, par
  // lots persistés au fil de l'eau — une interruption ne perd pas le travail
  // déjà fait.
  private async resolveEmbeddings(
    model: string,
    uniqueTexts: Map<string, string>,
  ): Promise<Map<string, number[]>> {
    const vectorByHash = new Map<string, number[]>()
    const allHashes = Array.from(uniqueTexts.keys())

    for (const chunk of chunks(allHashes, CACHE_QUERY_CHUNK)) {
      const found = await this.prisma.embeddingCache.findMany({
        where: { model, contentHash: { in: chunk } },
        select: { contentHash: true, vector: true },
      })
      for (const row of found) vectorByHash.set(row.contentHash, row.vector as number[])
    }

    const missing = allHashes.filter((hash) => !vectorByHash.has(hash))
    for (const chunk of chunks(missing, EMBED_BATCH_SIZE)) {
      const res = await this.nlpClient.embeddings(chunk.map((hash) => uniqueTexts.get(hash)!))
      await this.prisma.embeddingCache.createMany({
        data: chunk.map((hash, i) => ({
          model,
          contentHash: hash,
          vector: res.vectors[i] as unknown as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      })
      chunk.forEach((hash, i) => vectorByHash.set(hash, res.vectors[i]))
    }

    return vectorByHash
  }

  // Lance le job côté service Python et rend la main aussitôt — le calcul
  // (embeddings + UMAP + HDBSCAN) prend plusieurs minutes, le frontend
  // suit l'avancement via topicsJobStatus.
  async startTopics(documentId: string): Promise<{ jobId: string }> {
    const { trame, data } = await this.documentsService.getContent(documentId)
    // Les nœuds en attente (texte propre trop court) ne portent pas de thème
    // et parasitent la carte (points expulsés par UMAP) — retirés du corpus.
    const excluded = stubNodeIds(trame, data)
    const segments = buildSegments(data).filter((s) => !excluded.has(s.nodeId))
    if (segments.length < MIN_TOPIC_SEGMENTS) {
      throw new BadRequestException(
        `Pas assez de texte pour extraire des thèmes (${segments.length} segments, minimum ${MIN_TOPIC_SEGMENTS})`,
      )
    }
    return this.nlpClient.startTopicsJob(segments.map(({ id, text }) => ({ id, text })))
  }

  async topicsJobStatus(documentId: string, jobId: string): Promise<TopicsJobStatusResponse> {
    const job = await this.nlpClient.jobStatus(jobId)
    if (job.status === 'error') {
      return { status: 'error', pct: job.pct, step: job.step, error: job.error ?? 'erreur inconnue' }
    }
    if (job.status !== 'done' || !job.result) {
      return { status: job.status, pct: job.pct, step: job.step }
    }
    const analysis = await this.persistTopics(documentId, job.result)
    return { status: 'done', pct: 100, step: 'terminé', analysis }
  }

  private async persistTopics(
    documentId: string,
    result: NlpTopicsResult,
  ): Promise<DocumentAnalysisResponse> {
    const { trame, data } = await this.documentsService.getContent(documentId)

    const axeOfNode = new Map<string, string>()
    const walk = (node: TrameNode, axeId: string) => {
      axeOfNode.set(node.id, axeId)
      node.children.forEach((child) => walk(child, axeId))
    }
    trame.axes.forEach((axe) => walk(axe, axe.id))

    // Répartition thème × axe à partir des assignations par segment — le
    // nodeId est encodé dans l'id du segment (cf. segmentation.ts), rien à
    // conserver entre le lancement du job et son polling.
    const countsByAxe = new Map<string | null, Map<number, number>>()
    const segmentsByAxe = new Map<string | null, number>()
    for (const { id, topic } of result.assignments) {
      const nodeId = id.split('::')[0]
      const axeId = axeOfNode.get(nodeId) ?? null
      segmentsByAxe.set(axeId, (segmentsByAxe.get(axeId) ?? 0) + 1)
      if (topic === -1) continue
      const axeCounts = countsByAxe.get(axeId) ?? new Map<number, number>()
      axeCounts.set(topic, (axeCounts.get(topic) ?? 0) + 1)
      countsByAxe.set(axeId, axeCounts)
    }

    const segmentsTotal = result.assignments.length
    const outlierCount = result.topics.find((t) => t.topic === -1)?.count ?? 0
    const share = (count: number) =>
      segmentsTotal ? Math.round((count / segmentsTotal) * 1000) / 1000 : 0

    const topicBySegment = new Map(result.assignments.map((a) => [a.id, a.topic]))
    const projection = result.projection.map((point) => ({
      x: point.x,
      y: point.y,
      topicId: topicBySegment.get(point.id) ?? -1,
      nodeId: point.id.split('::')[0],
    }))

    const topics: TopicsAnalysis = {
      computedAt: new Date().toISOString(),
      model: result.model,
      params: result.params,
      segmentsTotal,
      outliers: { count: outlierCount, share: share(outlierCount) },
      topics: result.topics
        .filter((t) => t.topic !== -1)
        .sort((a, b) => b.count - a.count)
        .map((t) => ({
          topicId: t.topic,
          label: t.words.slice(0, TOPIC_LABEL_WORDS).map((w) => w.word).join(' · '),
          count: t.count,
          share: share(t.count),
          words: t.words,
        })),
      axes: trame.axes
        .map((axe) => ({
          axeId: axe.id as string | null,
          titre: data[axe.id]?.titre ?? '(sans titre)',
          segments: segmentsByAxe.get(axe.id) ?? 0,
          distribution: Array.from(countsByAxe.get(axe.id)?.entries() ?? [])
            .map(([topicId, count]) => ({ topicId, count }))
            .sort((a, b) => b.count - a.count),
        }))
        .filter((axe) => axe.segments > 0),
      projection,
    }

    const topicsJson = topics as unknown as Prisma.InputJsonValue
    await this.prisma.documentAnalysis.upsert({
      where: { documentId },
      create: { documentId, topics: topicsJson, topicsComputedAt: new Date() },
      update: { topics: topicsJson, topicsComputedAt: new Date() },
    })

    return this.get(documentId)
  }

  // Comparaison ad hoc de deux passages — indépendante de tout document,
  // aucun résultat persisté.
  async compare(texts: string[]): Promise<{ model: string; score: number }> {
    if (texts.length !== 2 || texts.some((t) => typeof t !== 'string' || !t.trim())) {
      throw new BadRequestException('Fournir exactement deux passages non vides')
    }
    const res = await this.nlpClient.similarity(texts.map((t) => t.trim()))
    return { model: res.model, score: res.matrix[0][1] }
  }

  async embeddingCacheStats(): Promise<{ entries: number }> {
    return { entries: await this.prisma.embeddingCache.count() }
  }

  // Supprime les vecteurs qui ne correspondent plus à aucun paragraphe
  // d'aucun document (textes modifiés, documents supprimés). Les hashes
  // valides sont recalculés par le même chemin que resolveEmbeddings —
  // garantie que la purge ne jette jamais un vecteur encore utile.
  async pruneEmbeddingCache(): Promise<{ removed: number; kept: number }> {
    const documents = await this.prisma.document.findMany({ select: { id: true } })
    const valid: string[] = []
    for (const document of documents) {
      const { data } = await this.documentsService.getContent(document.id)
      for (const item of Object.values(data)) {
        for (const text of plainParagraphTexts(item.texte)) {
          valid.push(createHash('sha256').update(text).digest('hex'))
        }
      }
    }
    const { count: removed } = await this.prisma.embeddingCache.deleteMany({
      where: { contentHash: { notIn: valid } },
    })
    return { removed, kept: await this.prisma.embeddingCache.count() }
  }

  async get(documentId: string): Promise<DocumentAnalysisResponse> {
    const found = await this.prisma.documentAnalysis.findUnique({ where: { documentId } })
    const { trame, data } = await this.documentsService.getContent(documentId)
    return {
      lexical: (found?.lexical as unknown as LexicalAnalysis | null) ?? null,
      semantic: (found?.semantic as unknown as SemanticAnalysis | null) ?? null,
      topics: (found?.topics as unknown as TopicsAnalysis | null) ?? null,
      completeness: assessCompleteness(trame, data),
    }
  }
}
