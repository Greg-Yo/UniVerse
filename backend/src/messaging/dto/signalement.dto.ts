import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CibleContenu, StatutSignalement } from '@prisma/client';

export class CreateSignalementPersonneDto {
  @ApiProperty({ description: 'Moderateur ou Admin Universite destinataire (cf. ET-13).' })
  @IsString()
  destinataireId!: string;

  @ApiPropertyOptional({ description: 'Canal concerne (si signalement lie a un canal).' })
  @IsOptional()
  @IsString()
  canalId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  sujet!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;
}

export class CreateSignalementContenuDto {
  @ApiProperty({ enum: CibleContenu })
  @IsEnum(CibleContenu)
  cible!: CibleContenu;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  livreId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  sujet!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;
}

export class UpdateStatutSignalementDto {
  @ApiProperty({ enum: StatutSignalement })
  @IsEnum(StatutSignalement)
  statut!: StatutSignalement;
}
