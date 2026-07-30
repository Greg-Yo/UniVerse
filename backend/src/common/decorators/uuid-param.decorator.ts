import { Param, ParseUUIDPipe } from '@nestjs/common';

/** Parametre de route UUID v4 (rejette les ids mal formes). */
export const UuidParam = (name = 'id') =>
  Param(name, new ParseUUIDPipe({ version: '4', errorHttpStatusCode: 400 }));
