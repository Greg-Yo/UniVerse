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
  @MaxLength(5000)
  description?: string;

  @ApiProperty({
    description:
      'Cle MinIO du fichier source (doit etre sous user/{votreId}/...). Upload YouTube cote serveur uniquement — youtubeId n\'est plus accepté du client.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  sourceObjectKey!: string;

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
