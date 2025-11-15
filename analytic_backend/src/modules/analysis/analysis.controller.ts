import { Controller, Get, Query } from '@nestjs/common';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('stores/openings')
  @CacheKey('analysis-stores-openings')
  @CacheTTL(300)
  async getStoreSnapshot(@Query('limit') limit?: string) {
    return this.analysisService.getStoreOpeningSnapshot(
      limit ? Number(limit) : undefined,
    );
  }
}
