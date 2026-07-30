import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PresignDto {
  @ApiProperty({ enum: ['resources', 'library'] })
  @IsIn(['resources', 'library'])
  bucket!: 'resources' | 'library';

  @ApiProperty({
    description:
      "Chemin relatif sous le prefixe user/{id}/ (ex: epreuves/2026/algo-l1.pdf). Le serveur impose le prefixe proprietaire a l'upload.",
    example: 'epreuves/2026/algo-l1.pdf',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  cle!: string;
}

export class PresignUploadDto extends PresignDto {
  @ApiProperty({
    description: 'Taille exacte du fichier en octets (signee dans la policy MinIO).',
    example: 1_048_576,
  })
  @IsInt()
  @Min(1)
  @Max(524_288_000) // 500 Mo plafond absolu ; plafond effectif selon le bucket
  tailleOctets!: number;

  @ApiPropertyOptional({
    description: 'Content-Type MIME attendu (signe dans la policy).',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentType?: string;
}
