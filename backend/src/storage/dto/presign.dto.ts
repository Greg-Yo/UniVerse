import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class PresignDto {
  @ApiProperty({ enum: ['resources', 'library'] })
  @IsIn(['resources', 'library'])
  bucket!: 'resources' | 'library';

  @ApiProperty({
    description:
      "Chemin relatif sous le prefixe user/{id}/ (ex: epreuves/2026/algo-l1.pdf). Le serveur impose le prefixe proprietaire a l'upload.",
    example: 'epreuves/2026/algo-l1.pdf',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  cle!: string;
}
