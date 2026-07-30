import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

export type BucketLogique = 'resources' | 'library';

export interface PresignUploadPolicy {
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
  contentType?: string;
}

/**
 * Stockage de fichiers via MinIO (S3-compatible), remplacant Supabase Storage.
 * Le client uploade/telecharge directement via des URLs pre-signees ; l'API ne
 * relaie jamais les octets (cf. plan).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucketResources: string;
  private readonly bucketLibrary: string;
  private readonly presignTtl: number;
  private readonly maxBytesResources: number;
  private readonly maxBytesLibrary: number;

  constructor(private readonly config: ConfigService) {
    this.client = new MinioClient({
      endPoint: config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: Number(config.get('MINIO_PORT') ?? 9000),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
    this.bucketResources = config.get<string>('MINIO_BUCKET_RESOURCES') ?? 'resources';
    this.bucketLibrary = config.get<string>('MINIO_BUCKET_LIBRARY') ?? 'library';
    this.presignTtl = Number(config.get('MINIO_PRESIGN_TTL') ?? 900);
    this.maxBytesResources = Number(config.get('MINIO_MAX_UPLOAD_RESOURCES') ?? 104_857_600); // 100 Mo
    this.maxBytesLibrary = Number(config.get('MINIO_MAX_UPLOAD_LIBRARY') ?? 524_288_000); // 500 Mo
  }

  async onModuleInit(): Promise<void> {
    for (const bucket of [this.bucketResources, this.bucketLibrary]) {
      const existe = await this.client.bucketExists(bucket).catch(() => false);
      if (!existe) {
        await this.client.makeBucket(bucket);
        this.logger.log(`Bucket MinIO cree : ${bucket}`);
      }
    }
  }

  private bucket(logique: BucketLogique): string {
    return logique === 'library' ? this.bucketLibrary : this.bucketResources;
  }

  plafondUpload(logique: BucketLogique): number {
    return logique === 'library' ? this.maxBytesLibrary : this.maxBytesResources;
  }

  /**
   * Policy POST pre-signee avec content-length-range (+ Content-Type optionnel).
   * Le client doit poster multipart/form-data avec les champs retournes.
   */
  async policyUpload(
    logique: BucketLogique,
    cle: string,
    tailleOctets: number,
    contentType?: string,
  ): Promise<PresignUploadPolicy> {
    const maxBytes = this.plafondUpload(logique);
    if (tailleOctets > maxBytes) {
      throw new Error(`Fichier trop volumineux (max ${maxBytes} octets pour ${logique})`);
    }

    const policy = this.client.newPostPolicy();
    policy.setBucket(this.bucket(logique));
    policy.setKey(cle);
    policy.setExpires(new Date(Date.now() + this.presignTtl * 1000));
    // Fenetre etroite autour de la taille declaree (+/- 0) : exact.
    policy.setContentLengthRange(tailleOctets, tailleOctets);
    if (contentType) {
      policy.setContentType(contentType);
    }

    const { postURL, formData } = await this.client.presignedPostPolicy(policy);
    return {
      url: postURL,
      fields: formData as Record<string, string>,
      maxBytes,
      contentType,
    };
  }

  /** URL pre-signee pour telecharger un objet (GET). */
  async urlTelechargement(logique: BucketLogique, cle: string): Promise<string> {
    return this.client.presignedGetObject(this.bucket(logique), cle, this.presignTtl);
  }

  /** Flux lisible d'un objet (ex. pour l'upload YouTube cote serveur). */
  async flux(logique: BucketLogique, cle: string): Promise<Readable> {
    return this.client.getObject(this.bucket(logique), cle);
  }

  async supprimer(logique: BucketLogique, cle: string): Promise<void> {
    await this.client.removeObject(this.bucket(logique), cle);
  }
}
