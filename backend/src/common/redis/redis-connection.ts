/**
 * Options de connexion Redis partagees (BullMQ, Socket.io, LoginThrottle).
 * L10 : active TLS si REDIS_TLS=true (reseau non de confiance / Redis manage).
 */
export function redisConnectionFromEnv(env: NodeJS.ProcessEnv = process.env): {
  host: string;
  port: number;
  password?: string;
  tls?: Record<string, never>;
} {
  const host = env.REDIS_HOST ?? 'localhost';
  const port = Number(env.REDIS_PORT ?? 6379);
  const password = env.REDIS_PASSWORD || undefined;
  const tls = env.REDIS_TLS === 'true' ? {} : undefined;
  return { host, port, password, ...(tls ? { tls } : {}) };
}
