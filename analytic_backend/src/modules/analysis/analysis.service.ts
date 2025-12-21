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
    console.log('[AnalysisService] calculateSurvival 호출:', { sector });

    // 1. 폐업한 점포 데이터 조회
    const closedStores = await this.storeService.findClosedStores(sector);
    console.log('[AnalysisService] 조회된 폐업 점포 수:', closedStores.length);

    if (closedStores.length === 0) {
      console.log('[AnalysisService] 폐업 점포가 없어 빈 배열 반환');
      return []; // 데이터가 없으면 빈 배열 반환
    }

    // 2. 업종별로 생존 일수를 그룹화
    const sectorGroups = new Map<string, number[]>();
    let skippedCount = 0;
    let negativeDurationCount = 0;

    for (const store of closedStores) {
      // 날짜 정보가 없으면 건너뛰기
      if (!store.closeDate || !store.openDate) {
        skippedCount++;
        continue;
      }

      // 날짜를 Date 객체로 변환 (문자열인 경우 처리)
      const closeDate =
        store.closeDate instanceof Date
          ? store.closeDate
          : new Date(store.closeDate);
      const openDate =
        store.openDate instanceof Date
          ? store.openDate
          : new Date(store.openDate);

      // 유효하지 않은 날짜 필터링
      if (isNaN(closeDate.getTime()) || isNaN(openDate.getTime())) {
        skippedCount++;
        continue;
      }

      // 생존 일수 계산 (밀리초 → 일수 변환)
      const durationMs = closeDate.getTime() - openDate.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      // 음수 값 필터링 (데이터 오류 방지)
      if (durationDays < 0) {
        negativeDurationCount++;
        console.warn(
          `[AnalysisService] 음수 생존 일수 발견: storeId=${store.id}, openDate=${openDate.toISOString()}, closeDate=${closeDate.toISOString()}, durationDays=${durationDays}`,
        );
        continue;
      }

      // 업종별로 생존 일수 배열에 추가
      if (!sectorGroups.has(store.sector)) {
        sectorGroups.set(store.sector, []);
      }
      sectorGroups.get(store.sector)?.push(durationDays);
    }

    console.log(
      '[AnalysisService] 날짜 정보 없음으로 건너뛴 점포:',
      skippedCount,
    );
    console.log(
      '[AnalysisService] 음수 생존 일수로 건너뛴 점포:',
      negativeDurationCount,
    );
    console.log('[AnalysisService] 업종별 그룹 수:', sectorGroups.size);

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

      console.log(
        `[AnalysisService] ${sectorName}: 평균 ${Math.round(avgDuration * 100) / 100}일, 샘플 크기 ${durations.length}`,
      );
    }

    console.log('[AnalysisService] 최종 결과:', results);
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
   * 생존 기간 분포 분석 (현재 영업 중인 점포 기준)
   *
   * 폐업 데이터가 없는 경우, 현재 영업 중인 점포들의 개업일부터 현재까지의 기간을
   * 여러 단계로 분류하여 생존 패턴을 분석합니다.
   *
   * @param sector 업종 코드 (선택값, 지정하면 해당 업종만 분석)
   * @returns 업종별 생존 기간 단계별 분포
   *
   * 단계 분류:
   * - 0-1년: 신규 개업 (0 ~ 365일)
   * - 1-3년: 안정화 단계 (366 ~ 1095일)
   * - 3-5년: 성장 단계 (1096 ~ 1825일)
   * - 5-10년: 성숙 단계 (1826 ~ 3650일)
   * - 10년 이상: 장기 영업 (3651일 이상)
   */
  async calculateSurvivalDistribution(sector?: string): Promise<
    Array<{
      sector: string;
      stages: Array<{
        stage: string;
        range: string;
        count: number;
        percentage: number;
      }>;
      totalCount: number;
    }>
  > {
    console.log('[AnalysisService] calculateSurvivalDistribution 호출:', {
      sector,
    });

    // 1. 현재 영업 중인 점포 조회 (closeDate가 NULL인 점포)
    const openStores = await this.storeService.findOpenStores(sector);
    console.log('[AnalysisService] 조회된 영업 중 점포 수:', openStores.length);

    if (openStores.length === 0) {
      console.log(
        '[AnalysisService] 영업 중인 점포가 없어 빈 배열 반환 (sector:',
        sector,
        ')',
      );
      return [];
    }

    // openDate가 있는 점포 수 확인
    const storesWithOpenDate = openStores.filter((s) => s.openDate);
    console.log(
      '[AnalysisService] openDate가 있는 점포 수:',
      storesWithOpenDate.length,
      '/',
      openStores.length,
    );

    // 2. 현재 날짜 기준
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. 생존 기간 단계 정의
    const stages = [
      { name: '0-1년', minDays: 0, maxDays: 365, label: '신규 개업' },
      { name: '1-3년', minDays: 366, maxDays: 1095, label: '안정화 단계' },
      { name: '3-5년', minDays: 1096, maxDays: 1825, label: '성장 단계' },
      { name: '5-10년', minDays: 1826, maxDays: 3650, label: '성숙 단계' },
      {
        name: '10년 이상',
        minDays: 3651,
        maxDays: Number.MAX_SAFE_INTEGER,
        label: '장기 영업',
      },
    ];

    // 4. 업종별로 그룹화
    const sectorGroups = new Map<
      string,
      Array<{ storeId: number; survivalDays: number }>
    >();

    for (const store of openStores) {
      if (!store.openDate || !store.sector) continue;

      // 개업일을 Date 객체로 변환 (문자열인 경우 처리)
      const openDate =
        store.openDate instanceof Date
          ? new Date(store.openDate)
          : new Date(store.openDate);
      openDate.setHours(0, 0, 0, 0);

      // 유효하지 않은 날짜 필터링
      if (isNaN(openDate.getTime())) {
        continue;
      }

      const durationMs = today.getTime() - openDate.getTime();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

      // 음수 값 필터링 (미래 날짜 오류 방지)
      if (durationDays < 0) {
        console.warn(
          `[AnalysisService] 음수 생존 일수 발견: storeId=${store.id}, openDate=${openDate.toISOString()}`,
        );
        continue;
      }

      if (!sectorGroups.has(store.sector)) {
        sectorGroups.set(store.sector, []);
      }
      sectorGroups.get(store.sector)?.push({
        storeId: store.id,
        survivalDays: durationDays,
      });
    }

    // 5. 업종별로 단계별 분포 계산
    const results: Array<{
      sector: string;
      stages: Array<{
        stage: string;
        range: string;
        count: number;
        percentage: number;
      }>;
      totalCount: number;
    }> = [];

    for (const [sectorName, stores] of sectorGroups.entries()) {
      const totalCount = stores.length;
      const stageCounts = new Map<string, number>();

      // 각 점포를 단계에 분류
      for (const store of stores) {
        for (const stage of stages) {
          if (
            store.survivalDays >= stage.minDays &&
            store.survivalDays <= stage.maxDays
          ) {
            const count = stageCounts.get(stage.name) ?? 0;
            stageCounts.set(stage.name, count + 1);
            break;
          }
        }
      }

      // 단계별 통계 생성
      const stageStats = stages.map((stage) => {
        const count = stageCounts.get(stage.name) ?? 0;
        const percentage =
          totalCount > 0
            ? Math.round((count / totalCount) * 100 * 100) / 100
            : 0;

        return {
          stage: stage.label,
          range: stage.name,
          count,
          percentage,
        };
      });

      results.push({
        sector: sectorName,
        stages: stageStats,
        totalCount,
      });

      console.log(
        `[AnalysisService] ${sectorName}: 총 ${totalCount}개 점포, 단계별 분포 계산 완료`,
      );
    }

    console.log('[AnalysisService] 생존 기간 분포 분석 완료');
    return results;
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
