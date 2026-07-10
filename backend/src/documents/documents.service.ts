import { Injectable, NotFoundException } from '@nestjs/common'
import { NodeType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { parseOdtBuffer, DataMap, HarmonizedItem } from '../import/odt-parser'
import { DocumentContent, DocumentSummary } from './dto'

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadOdt(buffer: Buffer, originalFilename: string): Promise<DocumentSummary> {
    const { result, data, trame } = await parseOdtBuffer(buffer)

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

      const createNode = (id: string, type: NodeType, item: HarmonizedItem, parentId: string | null, position: number) =>
        tx.node.create({
          data: {
            id,
            documentId: doc.id,
            type,
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

      for (let axeIndex = 0; axeIndex < trame.axes.length; axeIndex++) {
        const axeRef = trame.axes[axeIndex]
        await createNode(axeRef.id, NodeType.AXE, data[axeRef.id], null, axeIndex)

        for (let blocIndex = 0; blocIndex < axeRef.blocs.length; blocIndex++) {
          const blocRef = axeRef.blocs[blocIndex]
          await createNode(blocRef.id, NodeType.BLOC, data[blocRef.id], axeRef.id, blocIndex)

          for (let articleIndex = 0; articleIndex < blocRef.articles.length; articleIndex++) {
            const articleId = blocRef.articles[articleIndex]
            await createNode(articleId, NodeType.ARTICLE, data[articleId], blocRef.id, articleIndex)
          }
        }
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
        type: node.type.toLowerCase() as HarmonizedItem['type'],
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

    const axes = (childrenByParent.get(null) ?? []).map((axe) => ({
      id: axe.id,
      blocs: (childrenByParent.get(axe.id) ?? []).map((bloc) => ({
        id: bloc.id,
        articles: (childrenByParent.get(bloc.id) ?? []).map((article) => article.id),
      })),
    }))

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
