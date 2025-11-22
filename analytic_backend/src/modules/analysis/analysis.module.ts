import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { StoreModule } from '../store/store.module';
import { SpatialModule } from '../spatial/spatial.module';

@Module({
  imports: [StoreModule, SpatialModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
