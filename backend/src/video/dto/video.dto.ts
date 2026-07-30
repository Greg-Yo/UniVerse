import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

class BaseVideoDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  titre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID YouTube si la video est deja en ligne.' })
  @IsOptional()
  @IsString()
  youtubeId?: string;

  @ApiPropertyOptional({
    description:
      'Cle MinIO du fichier source (doit etre sous user/{votreId}/...). Upload YouTube cote serveur.',
  })
  @IsOptional()
  @IsString()
  sourceObjectKey?: string;

  @ApiPropertyOptional({ description: 'Ciblage niveau (exclusif avec matiere).' })
  @IsOptional()
  @IsString()
  niveauCibleId?: string;

  @ApiPropertyOptional({ description: 'Ciblage matiere (exclusif avec niveau).' })
  @IsOptional()
  @IsString()
  matiereCibleeId?: string;
}

export class CreateVideoCreateurDto extends BaseVideoDto {}

export class CreateVideoTdsDto extends BaseVideoDto {
  @ApiProperty()
  @IsString()
  groupeTdsId!: string;
}
