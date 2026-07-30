import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { StorageAccessService } from './storage-access.service';
import { PresignDto, PresignUploadDto } from './dto/presign.dto';
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
      'Policy POST pre-signee (taille + Content-Type signes, cle sous user/{id}/)',
  })
  async presignUpload(@CurrentUser() user: AuthUser, @Body() dto: PresignUploadDto) {
    const plafond = this.storage.plafondUpload(dto.bucket);
    if (dto.tailleOctets > plafond) {
      throw new BadRequestException(
        `tailleOctets depasse le plafond (${plafond} octets) pour le bucket ${dto.bucket}`,
      );
    }
    const cle = construireCleUpload(user.id, dto.cle);
    const policy = await this.storage.policyUpload(
      dto.bucket,
      cle,
      dto.tailleOctets,
      dto.contentType,
    );
    return {
      method: 'POST' as const,
      url: policy.url,
      fields: policy.fields,
      cle,
      bucket: dto.bucket,
      prefixe: prefixeProprietaire(user.id),
      maxBytes: policy.maxBytes,
    };
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
