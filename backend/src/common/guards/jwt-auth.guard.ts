import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guard d'authentification par JWT d'acces (strategie 'jwt'). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
