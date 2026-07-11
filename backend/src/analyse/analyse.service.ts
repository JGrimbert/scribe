import { createHash } from 'crypto'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { DocumentsService } from '../documents/documents.service'
import { computeWordFrequency, WordFrequencyEntry } from './word-frequency'
import { plainNodeText, plainParagraphTexts } from './plain-text'
import { NlpClientService } from './nlp-client.service'
import { dot, meanNormalized } from './vector-math'
import { DocumentAnalysisResponse, LexicalAnalysis, SemanticAnalysis, SemanticUnit } from './dto'

// Lots d'embeddings : assez petits pour que chaque appel HTTP au service
// Python reste sous les timeouts (undici coupe à 5 min sans en-têtes), assez
// gros pour amortir le batching du modèle.
const EMBED_BATCH_SIZE = 64
const CACHE_QUERY_CHUNK = 500
const NEIGHBORS_K = 8
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

  async recompute(documentId: string): Promise<DocumentAnalysisResponse> {
    const { data } = await this.documentsService.getContent(documentId)
    const wordFrequency = computeWordFrequency(data) as unknown as Prisma.InputJsonValue

    await this.prisma.documentAnalysis.upsert({
      where: { documentId },
      create: { documentId, wordFrequency },
      update: { wordFrequency, computedAt: new Date() },
    })

    return this.get(documentId)
  }

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

  async get(documentId: string): Promise<DocumentAnalysisResponse> {
    const found = await this.prisma.documentAnalysis.findUnique({ where: { documentId } })
    return {
      wordFrequency: found?.wordFrequency
        ? {
            computedAt: found.computedAt.toISOString(),
            entries: found.wordFrequency as unknown as WordFrequencyEntry[],
          }
        : null,
      lexical: (found?.lexical as unknown as LexicalAnalysis | null) ?? null,
      semantic: (found?.semantic as unknown as SemanticAnalysis | null) ?? null,
    }
  }
}
