export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    name: process.env.POSTGRES_DB ?? 'district_analytics_local_db',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    ttl: parseInt(process.env.CACHE_TTL ?? '300000', 10),
  },
});
