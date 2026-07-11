import { Module } from '@nestjs/common'
import { DocumentsModule } from '../documents/documents.module'
import { AnalyseController } from './analyse.controller'
import { AnalyseToolsController } from './analyse-tools.controller'
import { AnalyseService } from './analyse.service'
import { NlpClientService } from './nlp-client.service'

@Module({
  imports: [DocumentsModule],
  controllers: [AnalyseController, AnalyseToolsController],
  providers: [AnalyseService, NlpClientService],
})
export class AnalyseModule {}
