import { Controller, Get, Query } from '@nestjs/common';
import { StoreService } from './store.service';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    return this.storeService.findLatest(limit ? Number(limit) : undefined);
  }
}
