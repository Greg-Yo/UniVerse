import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ description: "Identifiant de l'utilisateur destinataire." })
  @IsString()
  destinataireId!: string;
}

export class PostMessageDto {
  /** L9 : texte brut — le front DOIT echapper/sanitizer (jamais innerHTML). */
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  contenu!: string;
}
