import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { StorageAccessService } from './storage-access.service';
import { PresignDto } from './dto/presign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user';
import {
  assertCleStockageValide,
  construireCleUpload,
  prefixeProprietaire,
} from '../common/storage/storage-key';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RankGuard)
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly access: StorageAccessService,
  ) {}

  @Post('presign/upload')
  @MinRang(Rang.formateur)
  @ApiOperation({
    summary:
      'URL pre-signee d\'upload (cle forcee sous user/{id}/ — formateurs et rangs superieurs)',
  })
  async presignUpload(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    const cle = construireCleUpload(user.id, dto.cle);
    const url = await this.storage.urlUpload(dto.bucket, cle);
    return { url, cle, bucket: dto.bucket, prefixe: prefixeProprietaire(user.id) };
  }

  @Post('presign/download')
  @ApiOperation({
    summary:
      'URL pre-signee de telechargement (fichier proprietaire ou reference en base)',
  })
  async presignDownload(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    const cle = assertCleStockageValide(dto.cle);
    await this.access.assertTelechargementAutorise(user, dto.bucket, cle);
    const url = await this.storage.urlTelechargement(dto.bucket, cle);
    return { url };
  }
}
