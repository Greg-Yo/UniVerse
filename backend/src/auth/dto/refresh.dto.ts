import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Le refresh token est lu depuis le cookie HttpOnly `universe_refresh`.
 * Le champ body reste optionnel pour compatibilite (clients natifs / tests).
 */
export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token (optionnel si cookie HttpOnly present).',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
