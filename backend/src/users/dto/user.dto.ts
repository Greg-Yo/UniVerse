import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatutDemande, TypeDemande } from '@prisma/client';

export class DemandeStatutDto {
  @ApiProperty({ enum: TypeDemande })
  @IsEnum(TypeDemande)
  type!: TypeDemande;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}

export class DecisionDemandeDto {
  @ApiProperty({ enum: StatutDemande, description: 'approuvee ou refusee' })
  @IsEnum(StatutDemande)
  statut!: StatutDemande;

  @ApiPropertyOptional({ description: "Universite a administrer (si promotion admin_universite)." })
  @IsOptional()
  @IsString()
  universiteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motif?: string;
}

export class CreateGroupeTdsDto {
  @ApiProperty()
  @IsString()
  tuteurId!: string;

  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiPropertyOptional({ description: 'Universite de reference (tag informatif uniquement).' })
  @IsOptional()
  @IsString()
  universiteReferenceId?: string;
}
