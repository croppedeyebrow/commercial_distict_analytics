import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'password',
  database: process.env.POSTGRES_DB ?? 'district_analytics_local_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: (process.env.NODE_ENV ?? 'development') !== 'production',
  logging: (process.env.NODE_ENV ?? 'development') === 'development',
  autoLoadEntities: true,
});
