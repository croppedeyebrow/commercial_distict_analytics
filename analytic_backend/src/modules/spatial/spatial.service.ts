import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface StoreWithinRadiusRow {
  id: string;
  storeName: string;
  sector: string | null;
  address: string | null;
  location: string;
}

@Injectable()
export class SpatialService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 반경 내 점포 목록 조회
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

    // 업종 필터 조건 추가
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

      return (Array.isArray(rows) ? rows : []).map((entry) => {
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
