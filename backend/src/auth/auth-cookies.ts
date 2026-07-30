import { createHash, randomBytes } from 'crypto';

export const REFRESH_COOKIE_NAME = 'universe_refresh';

export function optionsCookieRefresh(maxAgeMs: number) {
  const secure =
    process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as
      | 'strict'
      | 'lax',
    path: '/auth',
    maxAge: maxAgeMs,
  };
}

export function optionsCookieClear() {
  const secure =
    process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as
      | 'strict'
      | 'lax',
    path: '/auth',
  };
}

/** Jeton opaque de verification email (clair a transmettre une seule fois). */
export function genererJetonEmail(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash SHA-256 (suffisant pour un jeton a entropie elevee, plus rapide qu'argon2). */
export function hasherJetonEmail(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
