import { Controller, Get, Param, Post } from '@nestjs/common'
import { AnalyseService } from './analyse.service'
import { DocumentAnalysisResponse, TopicsJobStatusResponse } from './dto'

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

  // Extraction de thèmes : job asynchrone côté service Python. Le POST rend
  // un jobId immédiatement, le GET est pollé par le frontend et persiste le
  // résultat quand le job aboutit.
  @Post(':id/analyse/topics')
  startTopics(@Param('id') id: string): Promise<{ jobId: string }> {
    return this.analyseService.startTopics(id)
  }

  @Get(':id/analyse/topics/jobs/:jobId')
  topicsJobStatus(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
  ): Promise<TopicsJobStatusResponse> {
    return this.analyseService.topicsJobStatus(id, jobId)
  }
}
