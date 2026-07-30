import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLivreDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  titre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  auteurLivre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cle MinIO du fichier PDF/EPUB (bucket library).' })
  @IsString()
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
  titre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  auteurLivre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
