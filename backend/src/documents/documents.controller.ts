import { BadRequestException, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService } from './documents.service'
import { DocumentContent, DocumentSummary } from './dto'

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File): Promise<DocumentSummary> {
    if (!file) throw new BadRequestException('Fichier manquant (champ "file")')
    if (!/\.odt$/i.test(file.originalname)) throw new BadRequestException('Seuls les fichiers .odt sont acceptés')
    return this.documentsService.uploadOdt(file.buffer, file.originalname)
  }
}
