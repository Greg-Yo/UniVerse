import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthDbService } from '../auth-db.service';
import { AuthUser, JwtAccessPayload } from '../../common/types/auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly db: AuthDbService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Recharge l'utilisateur depuis la base (rang, rattachements, email verifie)
   * et verifie que la session liee au JWT n'est pas revoquee — ainsi logout /
   * changement de MDP invalident immediatement l'access token.
   */
  async validate(payload: JwtAccessPayload): Promise<AuthUser> {
    if (!payload.sid) {
      throw new UnauthorizedException('Access token invalide (session manquante)');
    }

    const [utilisateur, session] = await Promise.all([
      this.db.utilisateur.findUnique({
        where: { id: payload.sub },
        include: { groupeTds: { select: { id: true } } },
      }),
      this.db.sessionDevice.findUnique({ where: { id: payload.sid } }),
    ]);

    if (!utilisateur) {
      throw new UnauthorizedException('Utilisateur introuvable ou supprime');
    }
    if (!utilisateur.emailVerifie) {
      throw new UnauthorizedException('Email non verifie');
    }
    if (
      !session ||
      session.utilisateurId !== utilisateur.id ||
      session.revokedAt !== null ||
      session.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Session expiree ou revoquee');
    }

    return {
      id: utilisateur.id,
      email: utilisateur.email,
      rang: utilisateur.rang as unknown as AuthUser['rang'],
      niveauId: utilisateur.niveauId,
      universiteAdministreeId: utilisateur.universiteAdministreeId,
      estTuteurTds: Boolean(utilisateur.groupeTds),
    };
  }
}
