import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Probe DB : rate-limitee (L5) pour eviter le DoS via SELECT 1.
   * Les sondes UptimeRobot doivent preferer /health/live pour le liveness.
   */
  @Get()
  @ApiOperation({ summary: 'Sonde de sante (DB) — rate-limitee' })
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

  /** Liveness process — SkipThrottle pour les probes frequents (Caddy / k8s). */
  @Get('live')
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness (process en vie)' })
  live() {
    return { status: 'ok' };
  }
}
