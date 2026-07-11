import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { DocumentsService } from '../documents/documents.service'
import { computeWordFrequency, WordFrequencyEntry } from './word-frequency'
import { plainNodeText } from './plain-text'
import { NlpClientService } from './nlp-client.service'
import { DocumentAnalysisResponse, LexicalAnalysis } from './dto'

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
    }
  }
}
