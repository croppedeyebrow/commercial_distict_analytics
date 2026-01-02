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

  /**
   * 지역별 생존가능성 지표 계산
   *
   * 특정 위치 주변의 점포 생존 패턴을 분석하여 해당 지역의 생존가능성을 평가합니다.
   *
   * 평가 요소:
   * 1. 주변 점포의 평균 생존 기간
   * 2. 주변 점포의 생존 분포 (장기 영업 비율)
   * 3. 경쟁 강도 (동일 업종 점포 밀도)
   * 4. 업종 다양성
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터, 기본값: 500m)
   * @param sector 분석할 업종 코드 (선택값)
   * @returns 생존가능성 지표 (0-100 점수)
   */
  async calculateLocationSurvivalScore(
    lat: number,
    lng: number,
    radiusMeters: number = 500,
    sector?: string,
  ): Promise<{
    location: { lat: number; lng: number };
    radius: number;
    sector?: string;
    survivalScore: number; // 0-100 점수
    scoreBreakdown: {
      avgSurvivalDays: number; // 주변 점포 평균 생존 일수
      longTermStoreRatio: number; // 3년 이상 영업 중인 점포 비율
      competitionLevel: number; // 경쟁 강도 (점포 수)
      sectorDiversity: number; // 업종 다양성 (0-1)
    };
    recommendations: string[]; // 개선 권장사항
  }> {
    // 1. 반경 내 점포 조회
    const stores = await this.spatialService.findStoresWithinRadius(
      lat,
      lng,
      radiusMeters,
      sector,
    );

    if (stores.length === 0) {
      return {
        location: { lat, lng },
        radius: radiusMeters,
        sector,
        survivalScore: 50, // 데이터 부족 시 중간 점수
        scoreBreakdown: {
          avgSurvivalDays: 0,
          longTermStoreRatio: 0,
          competitionLevel: 0,
          sectorDiversity: 0,
        },
        recommendations: [
          '반경 내 점포 데이터가 부족합니다. 더 넓은 범위로 분석해보세요.',
        ],
      };
    }

    // 2. 주변 점포의 생존 분포 분석
    const openStores = await this.storeService.findOpenStores(sector);
    const now = new Date();
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(now.getFullYear() - 3);

    let longTermCount = 0;
    let totalSurvivalDays = 0;
    let validStoreCount = 0;
    const sectorSet = new Set<string>();

    for (const store of openStores) {
      // 반경 내 점포인지 확인 (간단한 거리 계산)
      const storeLocation = store.location;
      if (!storeLocation) continue;

      try {
        const locationJson = JSON.parse(storeLocation) as {
          type?: string;
          coordinates?: [number, number];
        };
        if (locationJson.type === 'Point' && locationJson.coordinates) {
          const [storeLng, storeLat] = locationJson.coordinates;
          // 간단한 거리 계산 (Haversine 공식 대신 근사값 사용)
          const distance = this.calculateDistance(lat, lng, storeLat, storeLng);
          if (distance <= radiusMeters) {
            sectorSet.add(store.sector || '');

            if (store.openDate) {
              const openDate = new Date(store.openDate);
              if (!isNaN(openDate.getTime())) {
                const daysSinceOpen = Math.floor(
                  (now.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24),
                );
                totalSurvivalDays += daysSinceOpen;
                validStoreCount++;

                if (openDate < threeYearsAgo) {
                  longTermCount++;
                }
              }
            }
          }
        }
      } catch {
        // JSON 파싱 실패 시 스킵
        continue;
      }
    }

    // 3. 지표 계산
    const avgSurvivalDays =
      validStoreCount > 0 ? totalSurvivalDays / validStoreCount : 0;
    const longTermStoreRatio =
      validStoreCount > 0 ? longTermCount / validStoreCount : 0;
    const competitionLevel = stores.length;
    const sectorDiversity = sectorSet.size / Math.max(stores.length, 1);

    // 4. 생존가능성 점수 계산 (가중 평균)
    // - 평균 생존 일수: 40% (365일 기준으로 정규화)
    // - 장기 영업 비율: 30%
    // - 경쟁 강도: 20% (적절한 경쟁은 좋음, 너무 많으면 감점)
    // - 업종 다양성: 10%

    const survivalDaysScore = Math.min((avgSurvivalDays / 365) * 100, 100);
    const longTermScore = longTermStoreRatio * 100;
    const competitionScore = Math.max(
      0,
      100 - Math.min((competitionLevel / 20) * 100, 100),
    ); // 20개 이상이면 감점
    const diversityScore = sectorDiversity * 100;

    const survivalScore =
      survivalDaysScore * 0.4 +
      longTermScore * 0.3 +
      competitionScore * 0.2 +
      diversityScore * 0.1;

    // 5. 권장사항 생성
    const recommendations: string[] = [];
    if (survivalScore < 50) {
      recommendations.push(
        '생존가능성이 낮은 지역입니다. 신중한 검토가 필요합니다.',
      );
    }
    if (competitionLevel > 15) {
      recommendations.push(
        '경쟁이 치열한 지역입니다. 차별화 전략이 필요합니다.',
      );
    }
    if (competitionLevel < 3) {
      recommendations.push('경쟁이 적은 지역입니다. 수요 확인이 필요합니다.');
    }
    if (longTermStoreRatio < 0.3) {
      recommendations.push(
        '장기 영업 점포 비율이 낮습니다. 지역 안정성 검토가 필요합니다.',
      );
    }
    if (sectorDiversity < 0.3) {
      recommendations.push(
        '업종 다양성이 낮습니다. 단일 업종 집중 지역일 수 있습니다.',
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('양호한 지역으로 판단됩니다.');
    }

    return {
      location: { lat, lng },
      radius: radiusMeters,
      sector,
      survivalScore: Math.round(survivalScore * 100) / 100,
      scoreBreakdown: {
        avgSurvivalDays: Math.round(avgSurvivalDays * 100) / 100,
        longTermStoreRatio: Math.round(longTermStoreRatio * 10000) / 100, // 백분율
        competitionLevel,
        sectorDiversity: Math.round(sectorDiversity * 10000) / 100, // 백분율
      },
      recommendations,
    };
  }

  /**
   * 좋은 자리 체크하기 (종합 분석)
   *
   * 특정 위치의 상권 적합성을 종합적으로 평가합니다.
   *
   * 평가 항목:
   * 1. 생존가능성 점수
   * 2. 경쟁 강도
   * 3. 접근성 (주변 점포 밀도)
   * 4. 업종 적합성
   *
   * @param lat 위도
   * @param lng 경도
   * @param sector 분석할 업종 코드 (필수값)
   * @param radiusMeters 반경 (미터, 기본값: 500m)
   * @returns 종합 평가 결과
   */
  async checkGoodLocation(
    lat: number,
    lng: number,
    sector: string,
    radiusMeters: number = 500,
  ): Promise<{
    location: { lat: number; lng: number };
    sector: string;
    radius: number;
    overallScore: number; // 0-100 종합 점수
    survivalScore: number; // 생존가능성 점수
    competitionScore: number; // 경쟁 강도 점수 (낮을수록 좋음)
    accessibilityScore: number; // 접근성 점수
    sectorFitScore: number; // 업종 적합성 점수
    detailedAnalysis: {
      nearbyStores: number; // 주변 점포 수
      sameSectorStores: number; // 동일 업종 점포 수
      avgSurvivalDays: number; // 평균 생존 일수
      sectorDiversity: number; // 업종 다양성
    };
    recommendations: Array<{
      type: 'positive' | 'warning' | 'negative';
      message: string;
    }>;
    riskFactors: string[]; // 위험 요소
    opportunities: string[]; // 기회 요소
  }> {
    // 1. 생존가능성 점수 계산
    const survivalData = await this.calculateLocationSurvivalScore(
      lat,
      lng,
      radiusMeters,
      sector,
    );

    // 2. 경쟁 강도 분석
    const sameSectorCount = await this.spatialService.countStoresInRadius(
      lat,
      lng,
      radiusMeters,
      sector,
    );

    // 3. 전체 점포 수 (접근성 지표)
    const allStores = await this.spatialService.findStoresWithinRadius(
      lat,
      lng,
      radiusMeters,
    );
    const nearbyStores = allStores.length;

    // 4. 경쟁 강도 점수 계산 (적절한 경쟁은 좋음)
    // 0-5개: 매우 좋음 (100점)
    // 6-10개: 좋음 (80점)
    // 11-15개: 보통 (60점)
    // 16-20개: 주의 (40점)
    // 21개 이상: 위험 (20점)
    let competitionScore = 100;
    if (sameSectorCount <= 5) {
      competitionScore = 100;
    } else if (sameSectorCount <= 10) {
      competitionScore = 80;
    } else if (sameSectorCount <= 15) {
      competitionScore = 60;
    } else if (sameSectorCount <= 20) {
      competitionScore = 40;
    } else {
      competitionScore = 20;
    }

    // 5. 접근성 점수 (주변 점포 밀도)
    // 점포가 많을수록 접근성이 좋음 (최대 100점)
    const accessibilityScore = Math.min((nearbyStores / 30) * 100, 100);

    // 6. 업종 적합성 점수 (생존 분포 기반)
    const sectorFitScore = survivalData.scoreBreakdown.longTermStoreRatio * 100;

    // 7. 종합 점수 계산 (가중 평균)
    const overallScore =
      survivalData.survivalScore * 0.4 +
      competitionScore * 0.3 +
      accessibilityScore * 0.2 +
      sectorFitScore * 0.1;

    // 8. 권장사항 및 위험/기회 요소 생성
    const recommendations: Array<{
      type: 'positive' | 'warning' | 'negative';
      message: string;
    }> = [];
    const riskFactors: string[] = [];
    const opportunities: string[] = [];

    if (overallScore >= 80) {
      recommendations.push({
        type: 'positive',
        message: '매우 좋은 위치로 판단됩니다.',
      });
    } else if (overallScore >= 60) {
      recommendations.push({
        type: 'positive',
        message: '양호한 위치입니다.',
      });
    } else if (overallScore >= 40) {
      recommendations.push({
        type: 'warning',
        message: '신중한 검토가 필요한 위치입니다.',
      });
    } else {
      recommendations.push({
        type: 'negative',
        message: '위험한 위치입니다. 다른 지역을 검토해보세요.',
      });
    }

    if (sameSectorCount > 20) {
      riskFactors.push('과도한 경쟁이 예상됩니다.');
      recommendations.push({
        type: 'warning',
        message: '경쟁이 매우 치열합니다. 차별화 전략이 필수입니다.',
      });
    } else if (sameSectorCount < 3) {
      opportunities.push('경쟁이 적어 진입 기회가 있습니다.');
    }

    if (survivalData.scoreBreakdown.avgSurvivalDays < 365) {
      riskFactors.push('주변 점포의 평균 생존 기간이 짧습니다.');
    }

    if (nearbyStores < 5) {
      riskFactors.push('주변 상권이 발달하지 않았습니다.');
    } else {
      opportunities.push('상권이 활성화되어 있습니다.');
    }

    if (survivalData.scoreBreakdown.sectorDiversity > 0.7) {
      opportunities.push('다양한 업종이 공존하는 지역입니다.');
    }

    return {
      location: { lat, lng },
      sector,
      radius: radiusMeters,
      overallScore: Math.round(overallScore * 100) / 100,
      survivalScore: survivalData.survivalScore,
      competitionScore,
      accessibilityScore: Math.round(accessibilityScore * 100) / 100,
      sectorFitScore: Math.round(sectorFitScore * 100) / 100,
      detailedAnalysis: {
        nearbyStores,
        sameSectorStores: sameSectorCount,
        avgSurvivalDays: survivalData.scoreBreakdown.avgSurvivalDays,
        sectorDiversity: survivalData.scoreBreakdown.sectorDiversity,
      },
      recommendations,
      riskFactors,
      opportunities,
    };
  }

  /**
   * 두 좌표 간 거리 계산 (Haversine 공식)
   *
   * @param lat1 첫 번째 위도
   * @param lng1 첫 번째 경도
   * @param lat2 두 번째 위도
   * @param lng2 두 번째 경도
   * @returns 거리 (미터)
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // 지구 반경 (미터)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
