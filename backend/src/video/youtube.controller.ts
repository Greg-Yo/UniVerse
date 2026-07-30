import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { YoutubeService } from './youtube.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';

/**
 * Configuration OAuth du compte YouTube institutionnel (Option A, cf. 5.3).
 * Le refresh token n'est JAMAIS renvoye dans une reponse HTTP.
 * Le callback exige un `state` CSRF one-time emis par auth-url.
 */
@ApiTags('videos')
@Controller('video/youtube')
export class YoutubeController {
  private readonly logger = new Logger(YoutubeController.name);

  constructor(private readonly youtube: YoutubeService) {}

  private assertBootstrapAutorise(): void {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_YOUTUBE_OAUTH_BOOTSTRAP !== 'true') {
      throw new ServiceUnavailableException(
        'Bootstrap OAuth YouTube desactive en production (ALLOW_YOUTUBE_OAUTH_BOOTSTRAP=true pour activer une fois).',
      );
    }
  }

  @Get('auth-url')
  @UseGuards(JwtAuthGuard, RankGuard)
  @MinRang(Rang.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'URL de consentement OAuth (Superadmin, config initiale)' })
  async authUrl() {
    this.assertBootstrapAutorise();
    const { url, state } = await this.youtube.creerAuthUrlAvecState();
    this.logger.log(`OAuth YouTube : state CSRF emis (len=${state.length})`);
    return { url };
  }

  /**
   * Landing OAuth (redirect Google) : publique car Google n'envoie pas de JWT.
   * Echange le code cote serveur et persiste le refresh token dans un fichier
   * local si YOUTUBE_REFRESH_TOKEN_FILE est defini — jamais dans la reponse.
   */
  @Get('callback')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Callback OAuth (ne renvoie jamais le refresh token)' })
  async callback(@Query('code') code: string, @Query('state') state: string) {
    this.assertBootstrapAutorise();
    if (!code) {
      return {
        obtained: false,
        message: 'Parametre code manquant. Relancez le flux OAuth.',
      };
    }
    if (!state || !(await this.youtube.consommerState(state))) {
      throw new BadRequestException(
        'Parametre state OAuth invalide ou expire (CSRF). Relancez depuis /video/youtube/auth-url.',
      );
    }

    const result = await this.youtube.echangerCodeEtPersister(code);
    if (!result.obtained) {
      return {
        obtained: false,
        message:
          'Aucun refresh token recu. Relancez avec access_type=offline et prompt=consent, ou utilisez `npm run youtube:token`.',
      };
    }

    this.logger.log(
      `OAuth YouTube : refresh token persiste=${result.persisted} (valeur jamais exposee en HTTP)`,
    );
    return {
      obtained: true,
      persisted: result.persisted,
      message: result.persisted
        ? 'Refresh token ecrit dans YOUTUBE_REFRESH_TOKEN_FILE. Copiez-le dans votre secret store puis redemarrez (supprimez le fichier). Desactivez ALLOW_YOUTUBE_OAUTH_BOOTSTRAP.'
        : 'Refresh token obtenu cote serveur sans fichier de sortie. Definissez YOUTUBE_REFRESH_TOKEN_FILE ou utilisez `npm run youtube:token` sur une machine de confiance.',
    };
  }
}
