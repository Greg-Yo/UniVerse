import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HierarchyService } from './hierarchy.service';
import {
  AssignModerateurDto,
  CreateCanalDto,
  CreateFaculteDto,
  CreateFiliereDto,
  CreateMatiereDto,
  CreateNiveauDto,
  CreateUniversiteDto,
  UpdateStatutUniversiteDto,
} from './dto/hierarchy.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('hierarchie')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RankGuard)
@Controller()
export class HierarchyController {
  constructor(private readonly hierarchy: HierarchyService) {}

  // --- Lecture ouverte ---
  @Get('universites')
  @ApiOperation({ summary: 'Liste des universites (multi-espaces, cf. ET-9)' })
  listerUniversites(@CurrentUser() user: AuthUser) {
    return this.hierarchy.listerUniversites(user);
  }

  @Get('universites/:id/arbre')
  @ApiOperation({ summary: 'Arbre complet d\'une universite (Faculte -> Canal)' })
  arbre(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.hierarchy.arbreUniversite(user, id);
  }

  // --- Superadmin ---
  @Post('universites')
  @MinRang(Rang.superadmin)
  @ApiOperation({ summary: 'Cree une universite (SA-1, statut en_attente)' })
  creerUniversite(@CurrentUser() user: AuthUser, @Body() dto: CreateUniversiteDto) {
    return this.hierarchy.creerUniversite(user, dto);
  }

  @Patch('universites/:id/statut')
  @MinRang(Rang.superadmin)
  @ApiOperation({ summary: 'Change le statut d\'une universite (en_attente/actif/suspendu)' })
  statut(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: UpdateStatutUniversiteDto,
  ) {
    return this.hierarchy.changerStatutUniversite(user, id, dto.statut);
  }

  // --- Admin Universite (AU-2) ---
  @Post('facultes')
  @MinRang(Rang.admin_universite)
  creerFaculte(@CurrentUser() user: AuthUser, @Body() dto: CreateFaculteDto) {
    return this.hierarchy.creerFaculte(user, dto);
  }

  @Post('filieres')
  @MinRang(Rang.admin_universite)
  creerFiliere(@CurrentUser() user: AuthUser, @Body() dto: CreateFiliereDto) {
    return this.hierarchy.creerFiliere(user, dto);
  }

  @Post('niveaux')
  @MinRang(Rang.admin_universite)
  creerNiveau(@CurrentUser() user: AuthUser, @Body() dto: CreateNiveauDto) {
    return this.hierarchy.creerNiveau(user, dto);
  }

  @Post('matieres')
  @MinRang(Rang.admin_universite)
  creerMatiere(@CurrentUser() user: AuthUser, @Body() dto: CreateMatiereDto) {
    return this.hierarchy.creerMatiere(user, dto);
  }

  @Post('canaux')
  @MinRang(Rang.admin_universite)
  creerCanal(@CurrentUser() user: AuthUser, @Body() dto: CreateCanalDto) {
    return this.hierarchy.creerCanal(user, dto);
  }

  @Post('attributions-moderateur')
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Assigne un moderateur a un canal (AU-1)' })
  assigner(@CurrentUser() user: AuthUser, @Body() dto: AssignModerateurDto) {
    return this.hierarchy.assignerModerateur(user, dto);
  }

  @Delete('attributions-moderateur/:moderateurId/:canalId')
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Retire un moderateur d\'un canal' })
  retirer(
    @CurrentUser() user: AuthUser,
    @UuidParam('moderateurId') moderateurId: string,
    @UuidParam('canalId') canalId: string,
  ) {
    return this.hierarchy.retirerModerateur(user, moderateurId, canalId);
  }
}
