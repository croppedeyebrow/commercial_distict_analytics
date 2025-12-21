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
    console.log('[StoreService] findClosedStores 호출:', { sector });

    // closeDate가 NULL이 아닌 조건 생성
    const where: { closeDate: any; sector?: string } = {
      closeDate: Not(IsNull()), // "closeDate IS NOT NULL" 조건
    };

    // 업종 필터가 있으면 추가
    if (sector) {
      where.sector = sector;
    }

    const result = await this.storeRepository.find({
      where,
      order: { closeDate: 'DESC' }, // 폐업일 내림차순
    });

    console.log('[StoreService] 조회된 폐업 점포 수:', result.length);
    if (result.length > 0) {
      console.log('[StoreService] 샘플 점포:', {
        id: result[0].id,
        sector: result[0].sector,
        openDate: result[0].openDate,
        closeDate: result[0].closeDate,
      });
    }

    return result;
  }

  /**
   * 현재 영업 중인 점포 목록 조회
   *
   * closeDate가 NULL인 점포만 조회합니다.
   * 생존 기간 분포 분석에 사용됩니다.
   *
   * @param sector 업종 코드 (선택값, 지정하면 해당 업종만 필터링)
   * @returns 현재 영업 중인 점포 목록 (개업일 오름차순)
   */
  async findOpenStores(sector?: string): Promise<StoreEntity[]> {
    console.log('[StoreService] findOpenStores 호출:', { sector });

    // closeDate가 NULL인 조건 생성
    const where: { closeDate: any; sector?: string } = {
      closeDate: IsNull(), // "closeDate IS NULL" 조건
    };

    // 업종 필터가 있으면 추가
    if (sector) {
      where.sector = sector;
    }

    const result = await this.storeRepository.find({
      where,
      order: { openDate: 'ASC' }, // 개업일 오름차순
    });

    console.log('[StoreService] 조회된 영업 중 점포 수:', result.length);
    if (result.length > 0) {
      console.log('[StoreService] 샘플 점포:', {
        id: result[0].id,
        sector: result[0].sector,
        openDate: result[0].openDate,
        closeDate: result[0].closeDate,
      });
    } else {
      // 데이터가 없을 때 원인 파악을 위한 추가 쿼리
      const totalCount = await this.storeRepository.count();
      const sectorCount = sector
        ? await this.storeRepository.count({ where: { sector } })
        : 0;
      const closedCount = sector
        ? await this.storeRepository.count({
            where: { sector, closeDate: Not(IsNull()) },
          })
        : await this.storeRepository.count({
            where: { closeDate: Not(IsNull()) },
          });
      console.log('[StoreService] 디버깅 정보:', {
        totalStores: totalCount,
        sectorStores: sectorCount,
        closedStores: closedCount,
        openStores: sectorCount - closedCount,
      });
    }
    return result;
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
