import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { JwtAccessPayload, JwtRefreshPayload } from '../common/types/auth-user';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signerAccess(payload: JwtAccessPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: Number(this.config.get('JWT_ACCESS_TTL') ?? 900),
    });
  }

  async signerRefresh(payload: JwtRefreshPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(this.config.get('JWT_REFRESH_TTL') ?? 2592000),
    });
  }

  async verifierRefresh(token: string): Promise<JwtRefreshPayload> {
    return this.jwt.verifyAsync<JwtRefreshPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  /** Genere un secret opaque additionnel melange au refresh token (rotation). */
  genererGrainRefresh(): string {
    return randomBytes(32).toString('hex');
  }

  hasherRefresh(token: string): Promise<string> {
    return argon2.hash(token);
  }

  verifierHashRefresh(hash: string, token: string): Promise<boolean> {
    return argon2.verify(hash, token);
  }

  dureeRefreshMs(): number {
    return Number(this.config.get('JWT_REFRESH_TTL') ?? 2592000) * 1000;
  }
}
