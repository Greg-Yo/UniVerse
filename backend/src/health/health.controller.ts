import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Sonde de sante (surveillee par UptimeRobot / Caddy)' })
  async health() {
    const checks: Record<string, 'ok' | 'ko'> = { db: 'ok' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.db = 'ko';
    }
    const global = Object.values(checks).every((v) => v === 'ok') ? 'ok' : 'degraded';
    return { status: global, checks, timestamp: new Date().toISOString() };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness (process en vie)' })
  live() {
    return { status: 'ok' };
  }
}
