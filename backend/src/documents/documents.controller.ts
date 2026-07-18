import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService } from './documents.service'
import { StructureShapes } from '../analyse/structure-shapes'
import { DocumentRules } from './rules'
import { LiminaireConfig } from './liminaire-config'
import {
  CommitImportRequest,
  CommitResponse,
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
  commit(@Param('previewId') previewId: string, @Body() corrections: CommitImportRequest): Promise<CommitResponse> {
    return this.documentsService.commitImport(previewId, corrections)
  }

  // Rejouer la calibration d'un document déjà importé, depuis le .odt conservé.
  // Rend un PreviewResponse ordinaire : le commit passe par la route ci-dessus,
  // c'est le previewId qui sait qu'il s'agit d'un remplacement. Un seul écran
  // de calibration côté frontend, qui n'a pas à connaître la différence.
  @Post(':id/recalibrate')
  recalibrate(@Param('id') id: string): Promise<PreviewResponse> {
    return this.documentsService.previewRecalibration(id)
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

  // Formes structurelles : la séquence de styles de chaque nœud, en RLE. Sert
  // les « modèles de structure » de l'écran de typologie. Renvoie des STYLES,
  // pas des rôles : la traduction se fait côté client, en réactif, pour que les
  // motifs se recomposent à chaque rôle changé sans aller-retour (cf.
  // structure-shapes.ts).
  @Get(':id/structure-shapes')
  getStructureShapes(@Param('id') id: string): Promise<StructureShapes> {
    return this.documentsService.getStructureShapes(id)
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

  // Tagging des pages liminaires (type + côté recto/verso), keyé par page.
  // Séparé de la typologie : décision par PAGE, pas par style (cf.
  // liminaire-config.ts).
  @Get(':id/liminaire-config')
  getLiminaireConfig(@Param('id') id: string): Promise<LiminaireConfig> {
    return this.documentsService.getLiminaireConfig(id)
  }

  @Put(':id/liminaire-config')
  saveLiminaireConfig(@Param('id') id: string, @Body() body: unknown): Promise<LiminaireConfig> {
    return this.documentsService.saveLiminaireConfig(id, body)
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
