import { Body, Controller, Delete, Get, Post } from '@nestjs/common'
import { AnalyseService } from './analyse.service'

// Outils d'analyse transverses, non rattachés à un document — d'où un
// contrôleur séparé de AnalyseController (qui vit sous /documents/:id).
@Controller('analyse')
export class AnalyseToolsController {
  constructor(private readonly analyseService: AnalyseService) {}

  // Nécessite le service Python — 503 explicite sinon.
  @Post('compare')
  compare(@Body() body: { texts?: string[] }): Promise<{ model: string; score: number }> {
    return this.analyseService.compare(body?.texts ?? [])
  }

  // Suggestion sémantique de type pour des pages liminaires (stateless : juste
  // du texte → un type). Ne se prononce que sur ce que le déterministe côté
  // frontend n'a pas résolu. 503 si le service NLP est éteint.
  @Post('liminaire-suggest')
  liminaireSuggest(
    @Body() body: { pages?: { key: string; text: string }[] },
  ): Promise<Record<string, { type: string; score: number }>> {
    return this.analyseService.suggestLiminaire(body?.pages ?? [])
  }

  @Get('embedding-cache')
  embeddingCacheStats(): Promise<{ entries: number }> {
    return this.analyseService.embeddingCacheStats()
  }

  @Delete('embedding-cache/orphans')
  pruneEmbeddingCache(): Promise<{ removed: number; kept: number }> {
    return this.analyseService.pruneEmbeddingCache()
  }
}
