import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { StatutUniversite } from '@prisma/client';

export class CreateUniversiteDto {
  @ApiProperty({ example: 'Universite de Yaounde 1' })
  @IsString()
  @MinLength(2)
  nom!: string;
}

export class UpdateStatutUniversiteDto {
  @ApiProperty({ enum: StatutUniversite })
  @IsEnum(StatutUniversite)
  statut!: StatutUniversite;
}

export class CreateFaculteDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsString()
  universiteId!: string;
}

export class CreateFiliereDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsString()
  faculteId!: string;
}

export class CreateNiveauDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsString()
  filiereId!: string;
}

export class CreateMatiereDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsString()
  niveauId!: string;
}

export class CreateCanalDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsString()
  matiereId!: string;
}

export class AssignModerateurDto {
  @ApiProperty()
  @IsString()
  moderateurId!: string;

  @ApiProperty()
  @IsString()
  canalId!: string;
}
