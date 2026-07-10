import { BadRequestException, Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService } from './documents.service'
import { CommitImportRequest, DocumentContent, DocumentSummary, PreviewResponse } from './dto'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(): Promise<DocumentSummary[]> {
    return this.documentsService.list()
  }

  @Get(':id')
  getContent(@Param('id') id: string): Promise<DocumentContent> {
    return this.documentsService.getContent(id)
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File): Promise<PreviewResponse> {
    if (!file) throw new BadRequestException('Fichier manquant (champ "file")')
    if (!/\.odt$/i.test(file.originalname)) throw new BadRequestException('Seuls les fichiers .odt sont acceptés')
    return this.documentsService.previewUpload(file.buffer, file.originalname)
  }

  @Post('preview/:previewId/commit')
  commit(@Param('previewId') previewId: string, @Body() corrections: CommitImportRequest): Promise<DocumentSummary> {
    return this.documentsService.commitImport(previewId, corrections)
  }
}
