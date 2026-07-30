import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateGroupeTdsDto, DecisionDemandeDto, DemandeStatutDto } from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RankGuard)
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('utilisateurs/:id')
  @ApiOperation({ summary: 'Profil public d\'un utilisateur' })
  profil(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.users.profil(user, id);
  }

  @Post('demandes-statut')
  @ApiOperation({ summary: 'Soumet une demande de promotion (ET-11)' })
  demander(@CurrentUser() user: AuthUser, @Body() dto: DemandeStatutDto) {
    return this.users.demander(user, dto);
  }

  @Get('demandes-statut/mes-demandes')
  @ApiOperation({ summary: 'Mes demandes de statut' })
  mesDemandes(@CurrentUser() user: AuthUser) {
    return this.users.mesDemandes(user);
  }

  @Get('demandes-statut/en-attente')
  @MinRang(Rang.superadmin)
  @ApiOperation({ summary: 'File des demandes a traiter (SA-3)' })
  enAttente(@CurrentUser() user: AuthUser) {
    return this.users.demandesEnAttente(user);
  }

  @Patch('demandes-statut/:id/decision')
  @MinRang(Rang.superadmin)
  @ApiOperation({ summary: 'Approuve/refuse une demande et applique la promotion (SA-4)' })
  decider(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: DecisionDemandeDto,
  ) {
    return this.users.decider(user, id, dto);
  }

  @Post('compte-createur')
  @MinRang(Rang.formateur)
  @ApiOperation({ summary: 'Cree/complete son compte createur (bio)' })
  compteCreateur(@CurrentUser() user: AuthUser, @Body('bio') bio?: string) {
    return this.users.creerCompteCreateur(user, bio);
  }

  @Post('abonnements/:compteCreateurId')
  @ApiOperation({ summary: 'S\'abonner a un createur (ET-6)' })
  sabonner(
    @CurrentUser() user: AuthUser,
    @UuidParam('compteCreateurId') id: string,
  ) {
    return this.users.sabonner(user, id);
  }

  @Delete('abonnements/:compteCreateurId')
  @ApiOperation({ summary: 'Se desabonner' })
  desabonner(
    @CurrentUser() user: AuthUser,
    @UuidParam('compteCreateurId') id: string,
  ) {
    return this.users.desabonner(user, id);
  }

  @Post('groupes-tds')
  @MinRang(Rang.superadmin)
  @ApiOperation({ summary: 'Cree un Groupe TDS (Superadmin designe le tuteur)' })
  creerGroupe(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupeTdsDto) {
    return this.users.creerGroupeTds(user, dto);
  }

  @Post('abonnements-tds/:groupeTdsId')
  @ApiOperation({ summary: 'S\'abonner a un Groupe TDS (TDS-3)' })
  sabonnerTds(
    @CurrentUser() user: AuthUser,
    @UuidParam('groupeTdsId') id: string,
  ) {
    return this.users.sabonnerTds(user, id);
  }
}
