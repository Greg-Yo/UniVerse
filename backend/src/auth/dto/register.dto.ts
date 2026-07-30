import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../common/validation/password';

export class RegisterDto {
  @ApiProperty({ example: 'etudiant@univ-yaounde1.cm' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 12,
    example: 'MotDePasse!2026',
    description: 'Min. 12 caracteres, majuscule, minuscule, chiffre, symbole',
  })
  @IsString()
  @MinLength(12)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  motDePasse!: string;

  @ApiProperty({ example: 'Ngono' })
  @IsString()
  nom!: string;

  @ApiPropertyOptional({ example: 'Aline' })
  @IsOptional()
  @IsString()
  prenom?: string;

  @ApiPropertyOptional({
    description: "Niveau d'etude de rattachement (orientation du contenu, cf. ET-1).",
  })
  @IsOptional()
  @IsString()
  niveauId?: string;
}
