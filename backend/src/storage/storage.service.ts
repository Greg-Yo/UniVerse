import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { Readable } from 'stream';

export type BucketLogique = 'resources' | 'library';

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

  /** URL pre-signee pour televerser un objet (PUT). */
  async urlUpload(logique: BucketLogique, cle: string): Promise<string> {
    return this.client.presignedPutObject(this.bucket(logique), cle, this.presignTtl);
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
