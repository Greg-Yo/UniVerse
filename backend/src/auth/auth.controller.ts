import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto, ResendVerificationDto } from './dto/verify-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import { TokenService } from './token.service';
import {
  REFRESH_COOKIE_NAME,
  optionsCookieClear,
  optionsCookieRefresh,
} from './auth-cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  private ctx(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private poserCookieRefresh(res: Response, refreshToken: string): void {
    res.cookie(
      REFRESH_COOKIE_NAME,
      refreshToken,
      optionsCookieRefresh(this.tokens.dureeRefreshMs()),
    );
  }

  private extraireRefresh(req: Request, dto?: RefreshDto): string {
    const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
      REFRESH_COOKIE_NAME
    ];
    const token = fromCookie || dto?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token manquant (cookie ou body)');
    }
    return token;
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inscription etudiant (email a verifier avant login)' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.ctx(req));
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Valide le jeton de verification email' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Renvoie un jeton de verification (reponse non enumerante)' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Connexion (email + mot de passe, email verifie requis)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(dto, this.ctx(req));
    if (tokens.refreshToken) {
      this.poserCookieRefresh(res, tokens.refreshToken);
    }
    // Ne pas renvoyer le refresh dans le JSON (cookie HttpOnly).
    return { accessToken: tokens.accessToken, utilisateur: tokens.utilisateur };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotation access/refresh (cookie HttpOnly prioritaire)' })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.extraireRefresh(req, dto);
    const tokens = await this.auth.refresh(refreshToken, this.ctx(req));
    if (tokens.refreshToken) {
      this.poserCookieRefresh(res, tokens.refreshToken);
    }
    return { accessToken: tokens.accessToken, utilisateur: tokens.utilisateur };
  }

  @Post('logout')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Revoque la session et efface le cookie refresh' })
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const refreshToken = this.extraireRefresh(req, dto);
      const payload = await this.tokens.verifierRefresh(refreshToken);
      await this.auth.logout(payload.sid);
    } catch {
      // Efface le cookie meme si le token est deja invalide.
    }
    res.clearCookie(REFRESH_COOKIE_NAME, optionsCookieClear());
    return { success: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change le mot de passe et revoque toutes les sessions' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changerMotDePasse(user.id, dto.motDePasseActuel, dto.nouveauMotDePasse);
    return { success: true, message: 'Mot de passe mis a jour. Reconnectez-vous.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur authentifie" })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
