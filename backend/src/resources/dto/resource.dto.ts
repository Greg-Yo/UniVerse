import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TypeRessource } from '@prisma/client';

export class CreateRessourceDto {
  @ApiProperty()
  @IsString()
  canalId!: string;

  @ApiProperty({ enum: TypeRessource })
  @IsEnum(TypeRessource)
  type!: TypeRessource;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  titre!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contenu?: string;

  @ApiPropertyOptional({ description: 'Cle MinIO du fichier (epreuve/corrige/audio).' })
  @IsOptional()
  @IsString()
  fichierCle?: string;
}

export class ReplyRessourceDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  contenu!: string;

  @ApiPropertyOptional({ description: 'Message parent pour une reponse imbriquee (ET-3).' })
  @IsOptional()
  @IsString()
  repondAId?: string;
}
