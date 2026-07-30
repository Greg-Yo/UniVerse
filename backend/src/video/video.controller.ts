import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideoService } from './video.service';
import { CreateVideoCreateurDto, CreateVideoTdsDto } from './dto/video.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RankGuard)
@Controller('videos')
export class VideoController {
  constructor(private readonly video: VideoService) {}

  @Post()
  @MinRang(Rang.formateur)
  @ApiOperation({ summary: 'Publie une video sur son profil createur (FO-1/EN-1)' })
  publierCreateur(@CurrentUser() user: AuthUser, @Body() dto: CreateVideoCreateurDto) {
    return this.video.publierCreateur(user, dto);
  }

  @Post('tds')
  @ApiOperation({ summary: 'Publie une video dans un Groupe TDS (TDS-2, tuteur uniquement)' })
  publierTds(@CurrentUser() user: AuthUser, @Body() dto: CreateVideoTdsDto) {
    if (!user.estTuteurTds) {
      throw new ForbiddenException('Seul un tuteur TDS peut publier dans un Groupe TDS');
    }
    return this.video.publierTds(user, dto);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Fil video oriente par niveau puis abonnements (ET-4)' })
  feed(@CurrentUser() user: AuthUser, @Query('avant') avant?: string) {
    return this.video.feed(user, avant);
  }

  @Get('recherche')
  @ApiOperation({ summary: 'Recherche par filtres (ET-15)' })
  rechercher(
    @CurrentUser() user: AuthUser,
    @Query('niveauCibleId') niveauCibleId?: string,
    @Query('matiereCibleeId') matiereCibleeId?: string,
    @Query('motCle') motCle?: string,
  ) {
    return this.video.rechercher(user, { niveauCibleId, matiereCibleeId, motCle });
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like une video (ET-17)' })
  liker(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.video.liker(user, id);
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Retire son like (ET-17)' })
  retirerLike(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.video.retirerLike(user, id);
  }

  @Patch(':id/masquer')
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Masque une video signalee (AU-9 / Superadmin)' })
  masquer(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.video.masquer(user, id, true);
  }

  @Patch(':id/demasquer')
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Retablit une video masquee' })
  demasquer(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.video.masquer(user, id, false);
  }
}
