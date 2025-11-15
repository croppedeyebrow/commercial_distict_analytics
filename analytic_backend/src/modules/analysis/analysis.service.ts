import { Injectable } from '@nestjs/common';
import { StoreService } from '../store/store.service';

@Injectable()
export class AnalysisService {
  constructor(private readonly storeService: StoreService) {}

  async getStoreOpeningSnapshot(limit = 50) {
    const stores = await this.storeService.findLatest(limit);
    return {
      sampleSize: stores.length,
      latestOpenedAt: stores[0]?.openDate ?? null,
      sectors: [
        ...new Set(stores.map((store) => store.sector).filter(Boolean)),
      ],
    };
  }
}
