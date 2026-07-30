import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, PostMessageDto } from './dto/conversation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('messagerie')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Ouvre une conversation directe (applique la matrice 3.8)' })
  creer(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.conversations.creerOuRecuperer(user, dto.destinataireId);
  }

  @Get()
  @ApiOperation({ summary: 'Liste mes conversations' })
  lister(@CurrentUser() user: AuthUser) {
    return this.conversations.lister(user);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Messages d\'une conversation (pagines)' })
  messages(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Query('avant') avant?: string,
  ) {
    return this.conversations.messages(user, id, avant);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Envoie un message (respecte la fenetre 24h Enseignant)' })
  poster(
    @CurrentUser() user: AuthUser,
    @UuidParam('id') id: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.conversations.posterMessage(user, id, dto.contenu);
  }
}
