import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreEntity } from './entities/store.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepository: Repository<StoreEntity>,
  ) {}

  async findLatest(limit = 50): Promise<StoreEntity[]> {
    return this.storeRepository.find({
      take: limit,
      order: { openDate: 'DESC' },
    });
  }
}
