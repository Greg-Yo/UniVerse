import { Body, Controller, Delete, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LibraryService } from './library.service';
import { CreateLivreDto, UpdateLivreDto } from './dto/livre.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('bibliotheque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RankGuard)
@Controller('livres')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Post()
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Ajoute un livre a la bibliotheque (AU-7)' })
  ajouter(@CurrentUser() user: AuthUser, @Body() dto: CreateLivreDto) {
    return this.library.ajouter(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Consulte la bibliotheque (lecture ouverte, ET-16)' })
  lister(
    @CurrentUser() user: AuthUser,
    @Query('niveauCibleId') niveauCibleId?: string,
    @Query('matiereCibleeId') matiereCibleeId?: string,
    @Query('motCle') motCle?: string,
  ) {
    return this.library.lister(user, { niveauCibleId, matiereCibleeId, motCle });
  }

  @Patch(':id')
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Modifie un livre (auteur de l\'ajout / Superadmin)' })
  modifier(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: UpdateLivreDto,
  ) {
    return this.library.modifier(user, id, dto);
  }

  @Delete(':id')
  @MinRang(Rang.admin_universite)
  @ApiOperation({ summary: 'Archive un livre (soft-delete)' })
  archiver(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.library.archiver(user, id);
  }
}
