import type { CacheModuleOptions } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

export const redisConfig = async (): Promise<CacheModuleOptions> => {
  const ttl = parseInt(process.env.CACHE_TTL ?? '300000', 10);
  const shouldUseRedis =
    (process.env.USE_REDIS ?? 'true').toLowerCase() !== 'false';

  if (!shouldUseRedis) {
    return {
      ttl,
    };
  }

  return {
    store: await redisStore({
      socket: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
      database: parseInt(process.env.REDIS_DB ?? '0', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ttl,
    }),
    ttl,
  };
};
