import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface StoreWithinRadiusRow {
  id: string;
  storeName: string;
  sector: string | null;
  address: string | null;
  location: string;
  distance?: number;
  openDate?: string | null;
}

export interface StoresWithinRadiusResponse {
  stores: StoreWithinRadiusRow[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

@Injectable()
export class SpatialService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * 반경 내 점포 목록 조회 (개선된 버전: 거리, 페이징, 정렬 지원)
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터)
   * @param sector 업종 코드 (선택값)
   * @param page 페이지 번호 (1부터 시작)
   * @param limit 페이지당 항목 수
   * @param sortBy 정렬 옵션
   * @returns 반경 내 점포 목록 (페이징 및 메타데이터 포함)
   */
  async findStoresWithinRadiusEnhanced(
    lat: number,
    lng: number,
    radiusMeters: number,
    sector?: string,
    page: number = 1,
    limit: number = 20,
    sortBy:
      | 'distance_asc'
      | 'distance_desc'
      | 'open_date_desc'
      | 'open_date_asc'
      | 'sector_asc' = 'open_date_desc',
  ): Promise<StoresWithinRadiusResponse> {
    const startTime = Date.now();

    // 업종 필터 조건
    const sectorCondition = sector ? `AND "sector" = $4` : '';
    const params: unknown[] = [lng, lat, radiusMeters];
    if (sector) {
      params.push(sector);
    }

    // 정렬 조건 생성
    let orderByClause = '';
    switch (sortBy) {
      case 'distance_asc':
        // 거리 계산을 포함한 정렬 (가까운 순)
        orderByClause = `ORDER BY ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) ASC`;
        break;
      case 'distance_desc':
        orderByClause = `ORDER BY ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) DESC`;
        break;
      case 'open_date_desc':
        orderByClause = `ORDER BY "openDate" DESC`;
        break;
      case 'open_date_asc':
        orderByClause = `ORDER BY "openDate" ASC`;
        break;
      case 'sector_asc':
        orderByClause = `ORDER BY "sector" ASC, "openDate" DESC`;
        break;
      default:
        orderByClause = `ORDER BY "openDate" DESC`;
    }

    // 전체 개수 조회 쿼리
    const countQuery = `
      SELECT COUNT(*) as count
      FROM store
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ${sectorCondition}
    `;

    // 데이터 조회 쿼리 (거리 정보 포함)
    const dataQuery = `
      SELECT
        id,
        "storeName",
        "sector",
        "address",
        "openDate",
        ST_AsGeoJSON(location) AS location,
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) AS distance
      FROM store
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ${sectorCondition}
      ${orderByClause}
      LIMIT $${sector ? '5' : '4'} OFFSET $${sector ? '6' : '5'}
    `;

    try {
      // 전체 개수 조회
      const countParams = [...params];
      const countResult = (await this.dataSource.query(
        countQuery,
        countParams,
      )) as unknown as Array<{ count: string | number }>;
      const totalCount = Number(countResult[0]?.count ?? 0);

      // 페이징 계산
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;

      // 데이터 조회
      const dataParams = [...params, limit, offset];
      const rows: unknown[] = await this.dataSource.query(
        dataQuery,
        dataParams,
      );

      const executionTime = Date.now() - startTime;
      console.log(
        `[SpatialService] 조회 완료: ${rows.length}개 점포 / 전체 ${totalCount}개 (실행 시간: ${executionTime}ms)`,
      );

      const toOptionalString = (value: unknown): string | null => {
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        return null;
      };

      const stores = (Array.isArray(rows) ? rows : []).map((entry) => {
        const row = entry as Record<string, unknown>;
        const distanceValue = row.distance ?? row['distance'];
        const distance =
          typeof distanceValue === 'number'
            ? Math.round(distanceValue * 100) / 100 // 소수점 2자리로 반올림
            : typeof distanceValue === 'string'
              ? Number.parseFloat(distanceValue)
              : 0;

        return {
          id: toOptionalString(row.id ?? row['ID']) ?? '',
          storeName: toOptionalString(row.storeName ?? row['store_name']) ?? '',
          sector: toOptionalString(row.sector),
          address: toOptionalString(row.address),
          location:
            toOptionalString(
              row.location ?? row['st_asgeojson'] ?? row['location_geojson'],
            ) ?? '',
          distance,
          openDate: toOptionalString(row.openDate ?? row['openDate']),
        };
      });

      return {
        stores,
        totalCount,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        `[SpatialService] 쿼리 실행 실패 (실행 시간: ${executionTime}ms):`,
        error,
      );
      throw error;
    }
  }

  /**
   * 반경 내 점포 목록 조회 (기존 메서드 - 하위 호환성 유지)
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터)
   * @param sector 업종 코드 (선택값, 지정하면 해당 업종만 필터링)
   * @returns 반경 내 점포 목록
   */
  async findStoresWithinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    sector?: string,
  ): Promise<StoreWithinRadiusRow[]> {
    const startTime = Date.now();

    // 캐시 키 생성 (좌표를 소수점 4자리로 반올림하여 캐시 효율성 향상)
    const cacheKey = this.generateCacheKey(lat, lng, radiusMeters, sector);

    // 캐시에서 조회 시도
    const cachedResult =
      await this.cacheManager.get<StoreWithinRadiusRow[]>(cacheKey);
    if (cachedResult) {
      const executionTime = Date.now() - startTime;
      console.log(
        `[SpatialService] 캐시 히트: ${cachedResult.length}개 점포 (실행 시간: ${executionTime}ms)`,
      );
      return cachedResult;
    }

    // 업종 필터 조건 추가
    const sectorCondition = sector ? `AND "sector" = $4` : '';
    const params: unknown[] = [lng, lat, radiusMeters];
    if (sector) {
      params.push(sector);
    }

    // 쿼리 최적화:
    // 1. 필요한 컬럼만 선택 (address는 선택적으로 유지)
    // 2. ST_DWithin을 먼저 필터링하여 인덱스 활용 최대화
    // 3. 정렬은 인덱스가 있는 openDate 사용 (이미 최적화됨)
    const query = `
      SELECT
        id,
        "storeName",
        "sector",
        "address",
        ST_AsGeoJSON(location) AS location
      FROM store
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ${sectorCondition}
      ORDER BY "openDate" DESC
      LIMIT 100;
    `;

    try {
      // 디버깅을 위한 로깅
      console.log('[SpatialService] 쿼리 파라미터:', {
        lat,
        lng,
        radiusMeters,
        sector: sector || '(전체)',
      });

      const rows: unknown[] = await this.dataSource.query(query, params);

      const executionTime = Date.now() - startTime;
      console.log(
        `[SpatialService] 조회 완료: ${rows.length}개 점포 (실행 시간: ${executionTime}ms)`,
      );

      // 데이터가 없을 때 로깅
      if (rows.length === 0) {
        console.log(
          `[SpatialService] 경고: 반경 ${radiusMeters}m 내 점포가 없습니다. (좌표: ${lat}, ${lng}, 업종: ${sector || '전체'})`,
        );
      }

      const toOptionalString = (value: unknown): string | null => {
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        return null;
      };

      const result = (Array.isArray(rows) ? rows : []).map((entry) => {
        const row = entry as Record<string, unknown>;
        return {
          id: toOptionalString(row.id ?? row['ID']) ?? '',
          storeName: toOptionalString(row.storeName ?? row['store_name']) ?? '',
          sector: toOptionalString(row.sector),
          address: toOptionalString(row.address),
          location:
            toOptionalString(
              row.location ?? row['st_asgeojson'] ?? row['location_geojson'],
            ) ?? '',
        };
      });

      // 결과를 캐시에 저장 (TTL: 5분 = 300,000ms)
      await this.cacheManager.set(cacheKey, result, 300000);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        `[SpatialService] 쿼리 실행 실패 (실행 시간: ${executionTime}ms):`,
        error,
      );
      throw error;
    }
  }

  /**
   * 캐시 키 생성
   *
   * 좌표를 소수점 4자리로 반올림하여 캐시 효율성 향상
   * (약 11m 정밀도로 충분하며, 캐시 히트율 향상)
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터)
   * @param sector 업종 코드 (선택값)
   * @returns 캐시 키
   */
  private generateCacheKey(
    lat: number,
    lng: number,
    radiusMeters: number,
    sector?: string,
  ): string {
    // 좌표를 소수점 4자리로 반올림 (약 11m 정밀도)
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;

    // 반경을 100m 단위로 반올림 (캐시 효율성 향상)
    const roundedRadius = Math.round(radiusMeters / 100) * 100;

    const sectorPart = sector ? `:${sector}` : ':all';
    return `spatial:stores:${roundedLat}:${roundedLng}:${roundedRadius}${sectorPart}`;
  }

  /**
   * 반경 내 특정 업종 점포 수 계산 (F-301)
   *
   * PostGIS를 사용하여 고성능 공간 쿼리로 점포 수를 계산합니다.
   * DB 레벨에서 필터링하므로 메모리 효율적입니다.
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터)
   * @param sector 업종 코드 (필수값)
   * @returns 반경 내 해당 업종 점포 수
   */
  async countStoresInRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    sector: string,
  ): Promise<number> {
    const query = `
      SELECT COUNT(*) AS count
      FROM store
      WHERE location IS NOT NULL
        AND "sector" = $4
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        );
    `;

    const rows: unknown[] = await this.dataSource.query(query, [
      lng,
      lat,
      radiusMeters,
      sector,
    ]);

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0] as Record<string, unknown>;
      const countValue = row.count ?? row['COUNT'];

      if (typeof countValue === 'number') {
        return countValue;
      }
      if (typeof countValue === 'string') {
        const parsed = Number.parseInt(countValue, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
    }

    return 0;
  }

  /**
   * 쿼리 실행 계획 분석 (EXPLAIN ANALYZE)
   *
   * 인덱스 사용 여부 및 성능 분석을 위한 디버깅 메서드
   *
   * @param lat 위도
   * @param lng 경도
   * @param radiusMeters 반경 (미터)
   * @param sector 업종 코드 (선택값)
   * @returns 쿼리 실행 계획
   */
  async explainQuery(
    lat: number,
    lng: number,
    radiusMeters: number,
    sector?: string,
  ): Promise<{
    query: string;
    explainPlan: string;
    executionTime?: number;
  }> {
    const sectorCondition = sector ? `AND "sector" = $4` : '';
    const params: unknown[] = [lng, lat, radiusMeters];
    if (sector) {
      params.push(sector);
    }

    const query = `
      SELECT
        id,
        "storeName",
        "sector",
        "address",
        ST_AsGeoJSON(location) AS location
      FROM store
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
        ${sectorCondition}
      ORDER BY "openDate" DESC
      LIMIT 100;
    `;

    const explainQuery = `EXPLAIN ANALYZE ${query}`;

    try {
      const explainResult = (await this.dataSource.query(
        explainQuery,
        params,
      )) as unknown as Array<Record<string, unknown>>;

      const explainPlan = Array.isArray(explainResult)
        ? explainResult
            .map((row: Record<string, unknown>) => {
              const planValue = row['QUERY PLAN'] ?? row['query plan'];
              if (planValue) {
                return typeof planValue === 'string'
                  ? planValue
                  : JSON.stringify(planValue);
              }
              return JSON.stringify(row);
            })
            .join('\n')
        : JSON.stringify(explainResult);

      return {
        query,
        explainPlan,
      };
    } catch (error) {
      console.error('[SpatialService] EXPLAIN ANALYZE 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 데이터베이스 상태 확인용 디버깅 정보 조회
   *
   * @returns location 데이터 통계 및 샘플 좌표
   */
  async getDebugInfo(): Promise<{
    totalStores: number;
    storesWithLocation: number;
    storesWithoutLocation: number;
    sampleLocations: Array<{
      id: number;
      storeName: string;
      lat: number;
      lng: number;
      sector: string;
    }>;
  }> {
    // 전체 점포 수
    const totalQuery = `SELECT COUNT(*) as count FROM store`;
    const totalResult = (await this.dataSource.query(
      totalQuery,
    )) as unknown as Array<{
      count: string | number;
    }>;
    const totalStores = Number(totalResult[0]?.count ?? 0);

    // location이 있는 점포 수
    const withLocationQuery = `SELECT COUNT(*) as count FROM store WHERE location IS NOT NULL`;
    const withLocationResult = (await this.dataSource.query(
      withLocationQuery,
    )) as unknown as Array<{ count: string | number }>;
    const storesWithLocation = Number(withLocationResult[0]?.count ?? 0);

    // location이 없는 점포 수
    const storesWithoutLocation = totalStores - storesWithLocation;

    // 샘플 좌표 조회 (최대 10개)
    const sampleQuery = `
      SELECT 
        id,
        "storeName",
        "sector",
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng
      FROM store
      WHERE location IS NOT NULL
      LIMIT 10
    `;
    const sampleRows = (await this.dataSource.query(
      sampleQuery,
    )) as unknown as Array<{
      id: string | number;
      storeName: string | null;
      sector: string | null;
      lat: string | number;
      lng: string | number;
    }>;

    const sampleLocations = sampleRows.map((row) => ({
      id: Number(row.id),
      storeName: row.storeName ?? '',
      lat: Number(row.lat),
      lng: Number(row.lng),
      sector: row.sector ?? '',
    }));

    return {
      totalStores,
      storesWithLocation,
      storesWithoutLocation,
      sampleLocations,
    };
  }
}
