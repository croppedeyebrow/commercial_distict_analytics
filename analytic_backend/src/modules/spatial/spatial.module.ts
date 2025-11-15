import { Module } from '@nestjs/common';
import { SpatialService } from './spatial.service';
import { SpatialController } from './spatial.controller';

@Module({
  controllers: [SpatialController],
  providers: [SpatialService],
  exports: [SpatialService],
})
export class SpatialModule {}
