import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../common/validation/password';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  motDePasseActuel!: string;

  @ApiProperty({
    minLength: 12,
    description: 'Min. 12 caracteres, majuscule, minuscule, chiffre, symbole',
  })
  @IsString()
  @MinLength(12)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  nouveauMotDePasse!: string;
}
