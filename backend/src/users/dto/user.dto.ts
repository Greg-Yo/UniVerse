import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TypeDemande } from '@prisma/client';

export class DemandeStatutDto {
  @ApiProperty({ enum: TypeDemande })
  @IsIn(Object.values(TypeDemande))
  type!: TypeDemande;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}

/** Decision Superadmin : uniquement approuvee | refusee (pas en_attente). */
export class DecisionDemandeDto {
  @ApiProperty({ enum: ['approuvee', 'refusee'], description: 'approuvee ou refusee' })
  @IsIn(['approuvee', 'refusee'])
  statut!: 'approuvee' | 'refusee';

  @ApiPropertyOptional({ description: "Universite a administrer (si promotion admin_universite)." })
  @IsOptional()
  @IsString()
  universiteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motif?: string;
}

export class CreateGroupeTdsDto {
  @ApiProperty()
  @IsString()
  tuteurId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nom!: string;

  @ApiPropertyOptional({ description: 'Universite de reference (tag informatif uniquement).' })
  @IsOptional()
  @IsString()
  universiteReferenceId?: string;
}

export class CompteCreateurDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}
