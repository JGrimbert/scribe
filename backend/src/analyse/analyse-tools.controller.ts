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

  @Get('embedding-cache')
  embeddingCacheStats(): Promise<{ entries: number }> {
    return this.analyseService.embeddingCacheStats()
  }

  @Delete('embedding-cache/orphans')
  pruneEmbeddingCache(): Promise<{ removed: number; kept: number }> {
    return this.analyseService.pruneEmbeddingCache()
  }
}
