import { Injectable } from '@nestjs/common';
import { StoreService } from '../store/store.service';
import { SpatialService } from '../spatial/spatial.service';

/**
 * 상권 분석 비즈니스 로직 서비스
 *
 * 점포 데이터를 활용하여 생존 기간, 경쟁 강도 등의 분석 지표를 계산합니다.
 * StoreService와 SpatialService를 조합하여 복잡한 분석 로직을 구현합니다.
 */
@Injectable()
export class AnalysisService {
  constructor(
    private readonly storeService: StoreService,
    private readonly spatialService: SpatialService,
  ) {}

  /**
   * 점포 개업 현황 스냅샷 조회
   *
   * 최근 개업한 점포들의 기본 통계를 제공합니다.
   *
   * @param limit 조회할 최대 개수 (기본값: 50)
   * @returns 샘플 크기, 최신 개업일, 업종 목록
   */
  async getStoreOpeningSnapshot(limit = 50) {
    const stores = await this.storeService.findLatest(limit);
    return {
      sampleSize: stores.length, // 조회된 점포 개수
      latestOpenedAt: stores[0]?.openDate ?? null, // 가장 최근 개업일
      sectors: [
        // 중복 제거된 업종 목록
        ...new Set(stores.map((store) => store.sector).filter(Boolean)),
      ],
    };
  }

  /**
   * 평균 생존 기간 계산
   *
   * 폐업한 점포들의 개업일과 폐업일을 비교하여 평균 생존 일수를 계산합니다.
   * 업종별로 그룹화하여 각 업종의 평균 생존 기간을 반환합니다.
   *
   * @param sector 업종 코드 (선택값, 지정하면 해당 업종만 분석)
   * @returns 업종별 평균 생존 일수와 샘플 크기 배열
   *
   * 예시 반환값:
   * [
   *   { sector: "C10", avgDurationDays: 365.5, sampleSize: 100 },
   *   { sector: "I20", avgDurationDays: 180.2, sampleSize: 50 }
   * ]
   */
  async calculateSurvival(sector?: string): Promise<
    Array<{
      sector: string;
      avgDurationDays: number;
      sampleSize: number;
    }>
  > {
    // 1. 폐업한 점포 데이터 조회
    const closedStores = await this.storeService.findClosedStores(sector);

    if (closedStores.length === 0) {
      return []; // 데이터가 없으면 빈 배열 반환
    }

    // 2. 업종별로 생존 일수를 그룹화
    const sectorGroups = new Map<string, number[]>();

    for (const store of closedStores) {
      // 날짜 정보가 없으면 건너뛰기
      if (!store.closeDate || !store.openDate) continue;

      // 생존 일수 계산 (밀리초 → 일수 변환)
      const durationMs = store.closeDate.getTime() - store.openDate.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      // 업종별로 생존 일수 배열에 추가
      if (!sectorGroups.has(store.sector)) {
        sectorGroups.set(store.sector, []);
      }
      sectorGroups.get(store.sector)?.push(durationDays);
    }

    // 3. 업종별 평균 생존 일수 계산
    const results: Array<{
      sector: string;
      avgDurationDays: number;
      sampleSize: number;
    }> = [];

    for (const [sectorName, durations] of sectorGroups.entries()) {
      // 평균 계산
      const avgDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;

      results.push({
        sector: sectorName,
        avgDurationDays: Math.round(avgDuration * 100) / 100, // 소수점 2자리 반올림
        sampleSize: durations.length, // 해당 업종의 폐업 점포 개수
      });
    }

    return results;
  }

  /**
   * 경쟁 강도 계산
   *
   * 특정 위치(좌표)와 반경 내에 있는 동일 업종 점포의 개수를 계산합니다.
   * 공간 분석을 통해 실제 경쟁 환경을 파악하는 데 사용됩니다.
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터 단위)
   * @param sector 업종 코드 (필수값)
   * @returns 해당 반경 내 동일 업종 점포 개수
   *
   * 사용 예시:
   * - 강남역(37.5, 127.0) 반경 500m 내 카페(C10) 개수 조회
   */
  /**
   * 경쟁 강도 계산 (F-402)
   *
   * 특정 위치(좌표)와 반경 내에 있는 동일 업종 점포의 개수를 계산합니다.
   * PostGIS를 사용하여 DB 레벨에서 고성능 공간 쿼리로 처리합니다.
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터 단위)
   * @param sector 업종 코드 (필수값)
   * @returns 해당 반경 내 동일 업종 점포 개수
   *
   * 사용 예시:
   * - 강남역(37.5, 127.0) 반경 500m 내 카페(C10) 개수 조회
   */
  async getCompetition(
    lat: number,
    lng: number,
    radiusMeters: number,
    sector: string,
  ): Promise<{ totalCount: number; sector: string }> {
    // SpatialService의 countStoresInRadius를 사용하여 DB 레벨에서 직접 계산
    // 이전 방식: 모든 점포를 가져온 후 메모리에서 필터링 (비효율적)
    // 개선: PostGIS 쿼리에서 업종 필터링까지 처리 (고성능, F-301 완성)
    const totalCount: number = await this.spatialService.countStoresInRadius(
      lat,
      lng,
      radiusMeters,
      sector,
    );

    return {
      totalCount,
      sector,
    };
  }

  /**
   * 분석 데이터 상태 확인용 디버깅 정보 조회
   *
   * @returns 각 분석 기능의 데이터 상태 정보
   */
  async getDebugInfo(): Promise<{
    storeOpeningSnapshot: {
      totalStores: number;
      recentStores: number;
      sectors: string[];
    };
    survivalAnalysis: {
      totalClosedStores: number;
      closedStoresBySector: Array<{ sector: string; count: number }>;
      sectorsWithData: string[];
    };
    competitionAnalysis: {
      storesWithLocation: number;
      storesWithoutLocation: number;
      sampleLocations: Array<{ lat: number; lng: number; sector: string }>;
    };
  }> {
    // 1. 개업 현황 스냅샷 데이터 상태
    const allStores = await this.storeService.findLatest(1000);
    const recentStores = await this.storeService.findLatest(50);
    const sectors = [
      ...new Set(allStores.map((store) => store.sector).filter(Boolean)),
    ] as string[];

    // 2. 생존 기간 분석 데이터 상태
    const allClosedStores = await this.storeService.findClosedStores();
    const closedStoresBySector = new Map<string, number>();
    for (const store of allClosedStores) {
      if (store.sector) {
        closedStoresBySector.set(
          store.sector,
          (closedStoresBySector.get(store.sector) ?? 0) + 1,
        );
      }
    }
    const closedStoresBySectorArray = Array.from(
      closedStoresBySector.entries(),
    ).map(([sector, count]) => ({ sector, count }));

    // 3. 경쟁 강도 분석 데이터 상태 (공간 데이터)
    const spatialDebugInfo = await this.spatialService.getDebugInfo();

    return {
      storeOpeningSnapshot: {
        totalStores: allStores.length,
        recentStores: recentStores.length,
        sectors,
      },
      survivalAnalysis: {
        totalClosedStores: allClosedStores.length,
        closedStoresBySector: closedStoresBySectorArray,
        sectorsWithData: closedStoresBySectorArray.map((item) => item.sector),
      },
      competitionAnalysis: {
        storesWithLocation: spatialDebugInfo.storesWithLocation,
        storesWithoutLocation: spatialDebugInfo.storesWithoutLocation,
        sampleLocations: spatialDebugInfo.sampleLocations.map((loc) => ({
          lat: loc.lat,
          lng: loc.lng,
          sector: loc.sector,
        })),
      },
    };
  }
}
