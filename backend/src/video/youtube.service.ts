import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, youtube_v3 } from 'googleapis';
import { createHash, randomBytes } from 'crypto';
import { Readable } from 'stream';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const STATE_TTL_MS = 10 * 60_000;

/**
 * Integration YouTube Data API v3 (Option A du cahier 5.3 : un compte YouTube
 * institutionnel possede les videos, le lien au createur est applicatif).
 * Les videos sont publiees en mode "non repertorie" (unlisted).
 */
@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private oauthClient?: OAuth2Client;
  /** state CSRF one-time (memoire process) — complete par fichier si multi-instance. */
  private readonly pendingStates = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  /** Client OAuth sans refresh token (bootstrap du consentement). */
  private createOAuthClient(): OAuth2Client {
    const clientId = this.config.get<string>('YOUTUBE_CLIENT_ID');
    const clientSecret = this.config.get<string>('YOUTUBE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('YOUTUBE_REDIRECT_URI');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        'Integration YouTube non configuree (YOUTUBE_CLIENT_ID/SECRET/REDIRECT_URI).',
      );
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getClient(): OAuth2Client {
    if (this.oauthClient) {
      return this.oauthClient;
    }
    const refreshToken = this.config.get<string>('YOUTUBE_REFRESH_TOKEN');
    if (!refreshToken) {
      throw new ServiceUnavailableException(
        'Integration YouTube non configuree (YOUTUBE_REFRESH_TOKEN manquant).',
      );
    }
    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    this.oauthClient = client;
    return client;
  }

  private api(): youtube_v3.Youtube {
    return google.youtube({ version: 'v3', auth: this.getClient() });
  }

  private stateFilePath(): string | undefined {
    return this.config.get<string>('YOUTUBE_OAUTH_STATE_FILE') ?? undefined;
  }

  private hashState(state: string): string {
    return createHash('sha256').update(state).digest('hex');
  }

  private async persisterState(state: string, expiresAt: number): Promise<void> {
    this.pendingStates.set(state, expiresAt);
    const file = this.stateFilePath();
    if (!file) {
      return;
    }
    const fs = await import('fs/promises');
    const payload = JSON.stringify({ hash: this.hashState(state), expiresAt });
    await fs.writeFile(file, payload, { encoding: 'utf8', mode: 0o600 });
  }

  /**
   * Genere l'URL de consentement OAuth avec un `state` CSRF one-time.
   * A utiliser une seule fois pour obtenir le refresh token institutionnel.
   */
  async creerAuthUrlAvecState(): Promise<{ url: string; state: string }> {
    const state = randomBytes(32).toString('hex');
    await this.persisterState(state, Date.now() + STATE_TTL_MS);
    const url = this.createOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
      state,
    });
    return { url, state };
  }

  /** @deprecated Preferer creerAuthUrlAvecState (CSRF). */
  getAuthUrl(): string {
    return this.createOAuthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/youtube.upload'],
    });
  }

  /** Valide et consomme le state (one-time). */
  async consommerState(state: string): Promise<boolean> {
    if (!state || state.length < 32) {
      return false;
    }

    const memExp = this.pendingStates.get(state);
    if (memExp !== undefined) {
      this.pendingStates.delete(state);
      return memExp > Date.now();
    }

    const file = this.stateFilePath();
    if (!file) {
      return false;
    }
    try {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as { hash?: string; expiresAt?: number };
      await fs.unlink(file).catch(() => undefined);
      if (!parsed.hash || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
        return false;
      }
      return parsed.hash === this.hashState(state);
    } catch {
      return false;
    }
  }

  /** Echange le code OAuth contre des tokens (dont le refresh token). */
  async echangerCode(code: string): Promise<{ refreshToken?: string | null }> {
    const { tokens } = await this.createOAuthClient().getToken(code);
    return { refreshToken: tokens.refresh_token };
  }

  /**
   * Echange le code et persiste le refresh token dans YOUTUBE_REFRESH_TOKEN_FILE
   * s'il est defini. Ne renvoie jamais la valeur du secret.
   */
  async echangerCodeEtPersister(
    code: string,
  ): Promise<{ obtained: boolean; persisted: boolean }> {
    const { refreshToken } = await this.echangerCode(code);
    if (!refreshToken) {
      return { obtained: false, persisted: false };
    }
    const outFile = this.config.get<string>('YOUTUBE_REFRESH_TOKEN_FILE');
    if (!outFile) {
      this.logger.warn(
        'YOUTUBE_REFRESH_TOKEN obtenu mais YOUTUBE_REFRESH_TOKEN_FILE non defini — secret non persiste.',
      );
      return { obtained: true, persisted: false };
    }
    const fs = await import('fs/promises');
    await fs.writeFile(outFile, refreshToken, { encoding: 'utf8', mode: 0o600 });
    return { obtained: true, persisted: true };
  }

  /**
   * Upload une video en mode non repertorie et renvoie son ID YouTube.
   * @param media flux lisible du fichier video (ex. depuis MinIO).
   */
  async uploaderVideo(params: {
    titre: string;
    description?: string;
    media: Readable;
  }): Promise<string> {
    try {
      const res = await this.api().videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title: params.titre, description: params.description ?? '' },
          status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
        },
        media: { body: params.media },
      });
      const id = res.data.id;
      if (!id) {
        throw new Error('YouTube n\'a pas renvoye d\'identifiant video');
      }
      this.logger.log(`Video YouTube publiee : ${id}`);
      return id;
    } catch (e) {
      this.logger.error(`Echec upload YouTube : ${(e as Error).message}`);
      throw e;
    }
  }
}
