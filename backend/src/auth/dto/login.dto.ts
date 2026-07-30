import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'etudiant@univ-yaounde1.cm' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  motDePasse!: string;

  @ApiPropertyOptional({ description: "Libelle de l'appareil (audit sessions)." })
  @IsOptional()
  @IsString()
  deviceLabel?: string;
}
