import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import appConfig from './app.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // 프로젝트 루트(district_analytics)의 .env 파일을 읽도록 경로 수정
      // __dirname은 dist/config/이므로 ../../../.env가 프로젝트 루트를 가리킴
      envFilePath: [
        join(__dirname, '../../../.env'), // 프로젝트 루트
        join(__dirname, '../../.env'), // analytic_backend 루트 (백업)
      ],
      load: [appConfig],
      cache: true,
    }),
  ],
})
export class AppConfigModule {}
