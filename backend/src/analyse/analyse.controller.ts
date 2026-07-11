import { Controller, Get, Param, Post } from '@nestjs/common'
import { AnalyseService } from './analyse.service'
import { DocumentAnalysisResponse } from './dto'

@Controller('documents')
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  @Get(':id/analyse')
  get(@Param('id') id: string): Promise<DocumentAnalysisResponse> {
    return this.analyseService.get(id)
  }

  @Post(':id/analyse')
  recompute(@Param('id') id: string): Promise<DocumentAnalysisResponse> {
    return this.analyseService.recompute(id)
  }

  // Nécessite le service Python (nlp-service/) — 503 explicite sinon.
  @Post(':id/analyse/lexical')
  recomputeLexical(@Param('id') id: string): Promise<DocumentAnalysisResponse> {
    return this.analyseService.recomputeLexical(id)
  }

  // Nécessite le service Python. Long au premier calcul (embeddings de tous
  // les paragraphes) ; les suivants repartent du cache par hash de contenu.
  @Post(':id/analyse/semantic')
  recomputeSemantic(@Param('id') id: string): Promise<DocumentAnalysisResponse> {
    return this.analyseService.recomputeSemantic(id)
  }
}
