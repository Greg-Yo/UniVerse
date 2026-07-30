import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Rang } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthDbService } from './auth-db.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUser, JwtAccessPayload } from '../common/types/auth-user';
import { genererJetonEmail, hasherJetonEmail } from './auth-cookies';
import { MailerService } from '../common/mailer/mailer.service';

export interface TokensResult {
  accessToken: string;
  /** Present uniquement si le client ne peut pas utiliser les cookies (ex. tests). */
  refreshToken?: string;
  utilisateur: AuthUser;
}

export interface RegisterResult {
  message: string;
  email: string;
  /** Expose uniquement hors production (ou EXPOSE_EMAIL_VERIFICATION_TOKEN=true). */
  verificationToken?: string;
}

interface ContexteConnexion {
  ip?: string;
  userAgent?: string;
  deviceLabel?: string;
}

const EMAIL_TOKEN_TTL_MS = 24 * 3600_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: AuthDbService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto, _ctx: ContexteConnexion): Promise<RegisterResult> {
    const existant = await this.db.utilisateur.findUnique({ where: { email: dto.email } });
    if (existant) {
      // Message generique pour limiter l'enumeration (aligné login).
      throw new ConflictException('Impossible de creer ce compte');
    }

    const jetonClair = genererJetonEmail();
    const motDePasseHash = await argon2.hash(dto.motDePasse);
    await this.db.utilisateur.create({
      data: {
        email: dto.email,
        motDePasseHash,
        nom: dto.nom,
        prenom: dto.prenom,
        niveauId: dto.niveauId,
        rang: Rang.etudiant,
        emailVerifie: false,
        emailVerificationTokenHash: hasherJetonEmail(jetonClair),
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    this.logger.log(`Inscription en attente de verification email : ${dto.email}`);

    await this.tenterEnvoiVerification(dto.email, jetonClair);

    const exposeToken =
      process.env.NODE_ENV !== 'production' ||
      process.env.EXPOSE_EMAIL_VERIFICATION_TOKEN === 'true';

    return {
      message: 'Compte cree. Verifiez votre email avant de vous connecter.',
      email: dto.email,
      ...(exposeToken ? { verificationToken: jetonClair } : {}),
    };
  }

  async verifyEmail(token: string): Promise<{ success: true }> {
    const hash = hasherJetonEmail(token);
    const utilisateur = await this.db.utilisateur.findFirst({
      where: {
        emailVerificationTokenHash: hash,
        emailVerificationExpiresAt: { gt: new Date() },
      },
    });
    if (!utilisateur) {
      throw new BadRequestException('Jeton de verification invalide ou expire');
    }

    await this.db.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        emailVerifie: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    return { success: true };
  }

  async resendVerification(email: string): Promise<{ message: string; verificationToken?: string }> {
    const utilisateur = await this.db.utilisateur.findUnique({ where: { email } });
    // Reponse uniforme pour ne pas reveler l'existence du compte.
    const message = 'Si un compte non verifie existe, un nouveau jeton a ete emis.';
    if (!utilisateur || utilisateur.emailVerifie) {
      return { message };
    }

    const jetonClair = genererJetonEmail();
    await this.db.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        emailVerificationTokenHash: hasherJetonEmail(jetonClair),
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const exposeToken =
      process.env.NODE_ENV !== 'production' ||
      process.env.EXPOSE_EMAIL_VERIFICATION_TOKEN === 'true';

    await this.tenterEnvoiVerification(email, jetonClair);

    return {
      message,
      ...(exposeToken ? { verificationToken: jetonClair } : {}),
    };
  }

  private lienVerification(token: string): string {
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
    const verifyPath = process.env.EMAIL_VERIFY_PATH ?? '/verify-email';
    const sep = verifyPath.includes('?') ? '&' : '?';
    return `${appUrl}${verifyPath}${sep}token=${encodeURIComponent(token)}`;
  }

  private async tenterEnvoiVerification(email: string, token: string): Promise<void> {
    const exposeToken =
      process.env.NODE_ENV !== 'production' ||
      process.env.EXPOSE_EMAIL_VERIFICATION_TOKEN === 'true';

    if (!this.mailer.estConfigure()) {
      if (!exposeToken) {
        throw new ServiceUnavailableException(
          'Service email indisponible. Reessayez plus tard.',
        );
      }
      this.logger.warn('SMTP non configure, jeton expose uniquement en mode dev/test.');
      return;
    }

    const lien = this.lienVerification(token);
    await this.mailer.envoyerVerificationEmail(email, lien);
  }

  async login(dto: LoginDto, ctx: ContexteConnexion): Promise<TokensResult> {
    const utilisateur = await this.db.utilisateur.findUnique({ where: { email: dto.email } });
    if (!utilisateur) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    const motDePasseOk = await argon2.verify(utilisateur.motDePasseHash, dto.motDePasse);
    if (!motDePasseOk) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (!utilisateur.emailVerifie) {
      throw new UnauthorizedException(
        'Email non verifie. Utilisez POST /auth/verify-email ou /auth/resend-verification.',
      );
    }
    return this.emettreTokens(utilisateur.id, { ...ctx, deviceLabel: dto.deviceLabel });
  }

  async refresh(refreshToken: string, ctx: ContexteConnexion): Promise<TokensResult> {
    let payload: { sub: string; sid: string };
    try {
      payload = await this.tokens.verifierRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }

    const session = await this.db.sessionDevice.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expiree ou revoquee');
    }

    const tokenOk = await this.tokens.verifierHashRefresh(session.refreshTokenHash, refreshToken);
    if (!tokenOk) {
      await this.db.sessionDevice.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token deja utilise');
    }

    return this.emettreTokens(session.utilisateurId, ctx, session.id);
  }

  async logout(sessionId: string): Promise<void> {
    await this.db.sessionDevice.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoque toutes les sessions actives (changement de rang / mot de passe). */
  async revoquerToutesSessions(utilisateurId: string): Promise<number> {
    const res = await this.db.sessionDevice.updateMany({
      where: { utilisateurId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  async changerMotDePasse(
    userId: string,
    motDePasseActuel: string,
    nouveauMotDePasse: string,
  ): Promise<{ success: true }> {
    const utilisateur = await this.db.utilisateur.findUniqueOrThrow({ where: { id: userId } });
    const ok = await argon2.verify(utilisateur.motDePasseHash, motDePasseActuel);
    if (!ok) {
      throw new UnauthorizedException('Mot de passe actuel invalide');
    }
    if (motDePasseActuel === nouveauMotDePasse) {
      throw new BadRequestException('Le nouveau mot de passe doit etre different');
    }

    await this.db.utilisateur.update({
      where: { id: userId },
      data: { motDePasseHash: await argon2.hash(nouveauMotDePasse) },
    });
    await this.revoquerToutesSessions(userId);
    return { success: true };
  }

  private async emettreTokens(
    utilisateurId: string,
    ctx: ContexteConnexion,
    sessionId?: string,
  ): Promise<TokensResult> {
    const utilisateur = await this.db.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      include: { groupeTds: { select: { id: true } } },
    });

    if (!utilisateur.emailVerifie) {
      throw new UnauthorizedException('Email non verifie');
    }

    const authUser: AuthUser = {
      id: utilisateur.id,
      email: utilisateur.email,
      rang: utilisateur.rang as unknown as AuthUser['rang'],
      niveauId: utilisateur.niveauId,
      universiteAdministreeId: utilisateur.universiteAdministreeId,
      estTuteurTds: Boolean(utilisateur.groupeTds),
    };

    const session = sessionId
      ? await this.db.sessionDevice.findUniqueOrThrow({ where: { id: sessionId } })
      : await this.db.sessionDevice.create({
          data: {
            utilisateurId,
            refreshTokenHash: 'pending',
            deviceLabel: ctx.deviceLabel,
            ip: ctx.ip,
            userAgent: ctx.userAgent,
            expiresAt: new Date(Date.now() + this.tokens.dureeRefreshMs()),
          },
        });

    const accessPayload: JwtAccessPayload = {
      sub: authUser.id,
      sid: session.id,
      email: authUser.email,
      rang: authUser.rang,
      niveauId: authUser.niveauId,
      universiteAdministreeId: authUser.universiteAdministreeId,
      estTuteurTds: authUser.estTuteurTds,
    };

    const accessToken = await this.tokens.signerAccess(accessPayload);
    const refreshToken = await this.tokens.signerRefresh({ sub: authUser.id, sid: session.id });
    const refreshTokenHash = await this.tokens.hasherRefresh(refreshToken);

    await this.db.sessionDevice.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + this.tokens.dureeRefreshMs()),
      },
    });

    return { accessToken, refreshToken, utilisateur: authUser };
  }
}
