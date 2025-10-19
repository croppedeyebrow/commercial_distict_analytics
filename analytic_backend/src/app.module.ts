import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
// import { redisStore } from 'cache-manager-redis-yet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestController } from './test/test.controller';

@Module({
  imports: [
    // 1. 환경 변수 로드 (DB 정보와 Redis 정보 모두 여기서 사용)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../.env'),
    }),

    // 2. TypeORM DB 연결 설정
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: (process.env.POSTGRES_HOST as string) || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: (process.env.POSTGRES_USER as string) || 'postgres',
      password: (process.env.POSTGRES_PASSWORD as string) || 'password',
      database:
        (process.env.POSTGRES_DB as string) || 'district_analytics_local_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: (process.env.NODE_ENV as string) !== 'production', // 개발 환경에서만 자동 동기화
      logging: (process.env.NODE_ENV as string) === 'development',
    }),

    // 3. 🚨 CacheModule 설정 (메모리 캐시 - 테스트용) 🚨
    CacheModule.register({
      isGlobal: true, // 앱 전체에서 캐싱을 사용할 수 있도록 전역 설정
      ttl: 60 * 5, // 캐시 유효 시간: 5분 (300초)
    }),
  ],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule {}

//경로 잘 확인하고 푸쉬하자
