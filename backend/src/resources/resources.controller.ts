import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { CreateRessourceDto, ReplyRessourceDto } from './dto/resource.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RankGuard } from '../common/guards/rank.guard';
import { MinRang } from '../common/decorators/roles.decorator';
import { Rang } from '../common/enums/rang.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('ressources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RankGuard)
@Controller('ressources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Post()
  @MinRang(Rang.moderateur)
  @ApiOperation({ summary: 'Publie une ressource dans un canal (MOD-1)' })
  publier(@CurrentUser() user: AuthUser, @Body() dto: CreateRessourceDto) {
    return this.resources.publier(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste les ressources d\'un canal (lecture ouverte, paginee)' })
  lister(
    @CurrentUser() user: AuthUser,
    @Query('canalId') canalId: string,
    @Query('avant') avant?: string,
  ) {
    return this.resources.listerParCanal(user, canalId, avant);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Fil de discussion d\'une ressource (ET-3)' })
  messages(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Query('avant') avant?: string,
  ) {
    return this.resources.messagesRessource(user, id, avant);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Repond dans le fil (reponse imbriquee possible, ET-3)' })
  repondre(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: ReplyRessourceDto,
  ) {
    return this.resources.repondre(user, id, dto);
  }

  @Delete(':id')
  @MinRang(Rang.moderateur)
  @ApiOperation({ summary: 'Archive (soft-delete) une ressource (MOD-4)' })
  archiver(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.resources.archiver(user, id);
  }
}
