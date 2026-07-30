import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SignalementsService } from './signalements.service';
import {
  CreateSignalementContenuDto,
  CreateSignalementPersonneDto,
  UpdateStatutSignalementDto,
} from './dto/signalement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('signalements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('signalements')
export class SignalementsController {
  constructor(private readonly signalements: SignalementsService) {}

  @Post('personne')
  @ApiOperation({ summary: 'Signaler un probleme a un Moderateur/Admin (ET-13)' })
  personne(@CurrentUser() user: AuthUser, @Body() dto: CreateSignalementPersonneDto) {
    return this.signalements.signalerPersonne(user, dto);
  }

  @Post('contenu')
  @ApiOperation({ summary: 'Signaler une Video ou un Livre problematique' })
  contenu(@CurrentUser() user: AuthUser, @Body() dto: CreateSignalementContenuDto) {
    return this.signalements.signalerContenu(user, dto);
  }

  @Get('recus')
  @ApiOperation({ summary: 'Signalements qui me sont adresses / que je traite' })
  recus(@CurrentUser() user: AuthUser) {
    return this.signalements.listerRecus(user);
  }

  @Patch(':id/statut')
  @ApiOperation({ summary: 'Faire evoluer le statut (en attente/en cours/resolu)' })
  statut(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: UpdateStatutSignalementDto,
  ) {
    return this.signalements.changerStatut(user, id, dto.statut);
  }
}
