import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService } from './documents.service'
import { DocumentRules } from './rules'
import {
  CommitImportRequest,
  DocumentContent,
  DocumentSummary,
  NodeValidationResponse,
  PreviewResponse,
  SaveTypologyRequest,
  TypologyResponse,
} from './dto'

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

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.documentsService.remove(id)
  }

  // Typologie des styles : ce que « Citation paragraphe » ou un surlignage
  // jaune veulent dire DANS ce document. Le GET sert aussi l'inventaire et les
  // suggestions — l'écran de configuration n'a qu'un appel à faire.
  @Get(':id/typology')
  getTypology(@Param('id') id: string): Promise<TypologyResponse> {
    return this.documentsService.getTypology(id)
  }

  @Put(':id/typology')
  saveTypology(@Param('id') id: string, @Body() body: SaveTypologyRequest): Promise<TypologyResponse> {
    return this.documentsService.saveTypology(id, body)
  }

  // Règles d'éligibilité : ce qu'un chapitre doit contenir pour être réputé
  // conforme. Indicatif — ça n'interdit pas de valider (cf. rules.ts).
  @Get(':id/rules')
  getRules(@Param('id') id: string): Promise<DocumentRules> {
    return this.documentsService.getRules(id)
  }

  @Put(':id/rules')
  saveRules(@Param('id') id: string, @Body() body: Partial<DocumentRules>): Promise<DocumentRules> {
    return this.documentsService.saveRules(id, body)
  }

  // Validation manuelle d'un chapitre (cf. NodeValidation, schema.prisma).
  // Rejouer le POST sur un chapitre périmé le revalide dans son état courant.
  @Post(':id/nodes/:nodeId/validation')
  validateNode(@Param('id') id: string, @Param('nodeId') nodeId: string): Promise<NodeValidationResponse> {
    return this.documentsService.validateNode(id, nodeId)
  }

  @Delete(':id/nodes/:nodeId/validation')
  @HttpCode(204)
  unvalidateNode(@Param('id') id: string, @Param('nodeId') nodeId: string): Promise<void> {
    return this.documentsService.unvalidateNode(id, nodeId)
  }
}
