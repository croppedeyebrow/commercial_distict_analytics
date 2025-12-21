import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { StoreEntity } from './entities/store.entity';

/**
 * 점포 데이터 접근 서비스
 *
 * StoreEntity에 대한 CRUD 작업을 담당합니다.
 * TypeORM Repository를 사용하여 데이터베이스와 통신합니다.
 */
@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepository: Repository<StoreEntity>,
  ) {}

  /**
   * 최근에 개업한 점포 목록 조회
   *
   * @param limit 조회할 최대 개수 (기본값: 50)
   * @returns 최근 개업일 순으로 정렬된 점포 목록
   */
  async findLatest(limit = 50): Promise<StoreEntity[]> {
    console.log('[StoreService] findLatest 호출:', { limit });
    const result = await this.storeRepository.find({
      take: limit,
      order: { openDate: 'DESC' }, // 개업일 내림차순 (최신순)
    });
    console.log('[StoreService] 조회된 점포 수:', result.length);
    return result;
  }

  /**
   * 특정 업종의 모든 점포 조회
   *
   * @param sector 업종 코드 (예: "C10")
   * @returns 해당 업종의 점포 목록 (개업일 내림차순)
   */
  async findAllBySector(sector: string): Promise<StoreEntity[]> {
    console.log('[StoreService] findAllBySector 호출:', { sector });
    const result = await this.storeRepository.find({
      where: { sector },
      order: { openDate: 'DESC' },
    });
    console.log('[StoreService] 조회된 점포 수:', result.length);
    return result;
  }

  /**
   * 폐업한 점포 목록 조회
   *
   * 생존 기간 분석에 사용됩니다.
   * closeDate가 NULL이 아닌 점포만 조회합니다.
   *
   * @param sector 업종 코드 (선택값, 지정하면 해당 업종만 필터링)
   * @returns 폐업한 점포 목록 (폐업일 내림차순)
   */
  async findClosedStores(sector?: string): Promise<StoreEntity[]> {
    // closeDate가 NULL이 아닌 조건 생성
    const where: { closeDate: any; sector?: string } = {
      closeDate: Not(IsNull()), // "closeDate IS NOT NULL" 조건
    };

    // 업종 필터가 있으면 추가
    if (sector) {
      where.sector = sector;
    }

    return this.storeRepository.find({
      where,
      order: { closeDate: 'DESC' }, // 폐업일 내림차순
    });
  }

  /**
   * 데이터베이스 상태 확인용 디버깅 정보 조회
   *
   * @returns 점포 데이터 통계 및 업종 목록
   */
  async getDebugInfo(): Promise<{
    totalStores: number;
    sectors: Array<{ sector: string; count: number }>;
    sampleStores: Array<{ id: number; storeName: string; sector: string }>;
  }> {
    // 전체 점포 수
    const totalStores = await this.storeRepository.count();

    // 업종별 점포 수
    const sectorQuery = await this.storeRepository
      .createQueryBuilder('store')
      .select('store.sector', 'sector')
      .addSelect('COUNT(*)', 'count')
      .groupBy('store.sector')
      .orderBy('count', 'DESC')
      .getRawMany();

    const sectors = (
      sectorQuery as Array<{ sector: string; count: string }>
    ).map((row) => ({
      sector: row.sector,
      count: Number(row.count),
    }));

    // 샘플 점포 조회 (최대 10개)
    const sampleStores = await this.storeRepository.find({
      take: 10,
      select: ['id', 'storeName', 'sector'],
    });

    return {
      totalStores,
      sectors,
      sampleStores: sampleStores.map((store) => ({
        id: store.id,
        storeName: store.storeName ?? '',
        sector: store.sector,
      })),
    };
  }
}
