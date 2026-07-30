import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EXACT_RANG_KEY, MIN_RANG_KEY } from '../decorators/roles.decorator';
import { Rang, rangAuMoins } from '../enums/rang.enum';
import { AuthUser } from '../types/auth-user';

/**
 * Verifie les exigences de rang posees par @MinRang / @ExactRang.
 * A utiliser APRES JwtAuthGuard. Couche applicative de la defense en profondeur
 * (la seconde couche etant la RLS PostgreSQL).
 */
@Injectable()
export class RankGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minRang = this.reflector.getAllAndOverride<Rang | undefined>(MIN_RANG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const exactRangs = this.reflector.getAllAndOverride<Rang[] | undefined>(EXACT_RANG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!minRang && (!exactRangs || exactRangs.length === 0)) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('Authentification requise');
    }

    if (exactRangs && exactRangs.length > 0) {
      if (!exactRangs.includes(user.rang)) {
        throw new ForbiddenException('Rang exact requis non satisfait');
      }
      return true;
    }

    if (minRang && !rangAuMoins(user.rang, minRang)) {
      throw new ForbiddenException(`Rang insuffisant (minimum requis: ${minRang})`);
    }

    return true;
  }
}
