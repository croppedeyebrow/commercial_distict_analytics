import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { StoreModule } from './modules/store/store.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { SpatialModule } from './modules/spatial/spatial.module';
import { TestModule } from './modules/test/test.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRoot(databaseConfig()),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: redisConfig,
    }),
    StoreModule,
    AnalysisModule,
    SpatialModule,
    TestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
