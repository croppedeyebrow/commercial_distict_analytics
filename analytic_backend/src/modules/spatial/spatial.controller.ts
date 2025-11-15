import { Controller, Get, Query, ParseFloatPipe } from '@nestjs/common';
import { SpatialService, StoreWithinRadiusRow } from './spatial.service';

@Controller('spatial')
export class SpatialController {
  constructor(private readonly spatialService: SpatialService) {}

  @Get('stores-within-radius')
  async getStoresWithinRadius(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', ParseFloatPipe) radius: number,
  ): Promise<StoreWithinRadiusRow[]> {
    return this.spatialService.findStoresWithinRadius(lat, lng, radius);
  }
}
