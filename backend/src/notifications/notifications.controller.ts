import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UuidParam } from '../common/decorators/uuid-param.decorator';
import { AuthUser } from '../common/types/auth-user';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste mes notifications (ET-7)' })
  lister(@CurrentUser() user: AuthUser, @Query('nonLues') nonLues?: string) {
    return this.notifications.lister(user, nonLues === 'true');
  }

  @Patch(':id/lu')
  @ApiOperation({ summary: 'Marque une notification comme lue' })
  marquerLu(@CurrentUser() user: AuthUser, @UuidParam('id') id: string) {
    return this.notifications.marquerLu(user, id);
  }
}
