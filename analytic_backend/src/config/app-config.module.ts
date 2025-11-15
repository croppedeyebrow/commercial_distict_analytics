import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { join } from 'path';
import appConfig from './app.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '../../.env'),
      load: [appConfig],
      cache: true,
    }),
  ],
})
export class AppConfigModule {}
