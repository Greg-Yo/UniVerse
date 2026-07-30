import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Le refresh token est lu depuis le cookie HttpOnly `universe_refresh`.
 * Le champ body n'est accepte qu'hors production (ou ALLOW_REFRESH_BODY=true).
 */
export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token (dev/tests uniquement si cookie absent).',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
