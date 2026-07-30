import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLivreDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  titre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  auteurLivre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ description: 'Cle MinIO du fichier PDF/EPUB (bucket library).' })
  @IsString()
  @MaxLength(512)
  fichierCle!: string;

  @ApiPropertyOptional({ description: 'Ciblage niveau (exclusif avec matiere).' })
  @IsOptional()
  @IsString()
  niveauCibleId?: string;

  @ApiPropertyOptional({ description: 'Ciblage matiere (exclusif avec niveau).' })
  @IsOptional()
  @IsString()
  matiereCibleeId?: string;
}

export class UpdateLivreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  titre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  auteurLivre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
