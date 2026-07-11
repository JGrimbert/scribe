import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './prisma/prisma.module'
import { DocumentsModule } from './documents/documents.module'
import { AnalyseModule } from './analyse/analyse.module'

@Module({
  imports: [PrismaModule, DocumentsModule, AnalyseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
