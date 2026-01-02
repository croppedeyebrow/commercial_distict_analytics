import {
  Controller,
  Get,
  Query,
  ParseFloatPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SpatialService, StoreWithinRadiusRow } from './spatial.service';

/**
 * 공간 분석 API 컨트롤러
 *
 * PostGIS를 활용한 공간 쿼리 기능을 제공합니다.
 * 엔드포인트: /spatial
 */
@ApiTags('spatial')
@Controller('spatial')
export class SpatialController {
  constructor(private readonly spatialService: SpatialService) {}

  /**
   * 반경 내 점포 목록 조회 API
   *
   * GET /spatial/stores-within-radius
   *
   * 특정 좌표를 중심으로 반경 내에 있는 점포 목록을 조회합니다.
   * PostGIS의 ST_DWithin 함수를 사용하여 고성능 공간 쿼리를 수행합니다.
   *
   * @param lat 위도 (-90 ~ 90)
   * @param lng 경도 (-180 ~ 180)
   * @param radius 반경 (미터 단위, 1 ~ 10000)
   * @param sector 업종 코드 (선택값, 지정하면 해당 업종만 필터링)
   * @returns 반경 내 점포 목록 (최대 100개)
   *
   * 사용 예시:
   * - GET /spatial/stores-within-radius?lat=37.5665&lng=126.9780&radius=500
   * - GET /spatial/stores-within-radius?lat=37.5665&lng=126.9780&radius=500&sector=C10
   */
  @Get('stores-within-radius')
  @ApiOperation({
    summary: '반경 내 점포 목록 조회',
    description: `특정 좌표를 중심으로 지정된 반경(미터) 내에 있는 점포 목록을 조회합니다. PostGIS를 사용하여 공간 인덱스를 활용한 고성능 쿼리를 수행합니다.

**서울 주요 지역 좌표 (테스트용)**:
- 명동: lat=37.5636, lng=126.9826
- 강남역: lat=37.4980, lng=127.0276
- 홍대입구: lat=37.5563, lng=126.9236
- 이태원: lat=37.5345, lng=126.9949
- 종로3가: lat=37.5704, lng=126.9918
- 잠실: lat=37.5133, lng=127.1028

**권장 반경**:
- 100m: 매우 좁은 범위 (건물 단위)
- 500m: 도보 5분 거리
- 1000m: 도보 10분 거리
- 2000m: 넓은 상권 분석`,
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    type: Number,
    description: '중심점 위도 (-90 ~ 90)',
    example: 37.5665,
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    type: Number,
    description: '중심점 경도 (-180 ~ 180)',
    example: 126.978,
  })
  @ApiQuery({
    name: 'radius',
    required: true,
    type: Number,
    description: '반경 (미터 단위, 1 ~ 10000)',
    example: 500,
  })
  @ApiQuery({
    name: 'sector',
    required: false,
    type: String,
    description: '업종 코드 (선택값, 예: C10=카페)',
    example: 'C10',
  })
  @ApiResponse({
    status: 200,
    description: '반경 내 점포 목록',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '점포 ID' },
          storeName: { type: 'string', description: '점포명' },
          sector: { type: 'string', nullable: true, description: '업종 코드' },
          address: { type: 'string', nullable: true, description: '주소' },
          location: {
            type: 'string',
            description: 'GeoJSON 형식의 위치 정보',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 파라미터',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          examples: [
            '위도는 -90 ~ 90 범위여야 합니다. 입력된 값: 100',
            '경도는 -180 ~ 180 범위여야 합니다. 입력된 값: 200',
            '반경은 최소 1미터 이상이어야 합니다. 입력된 값: 0',
            '반경은 최대 10,000미터(10km) 이하여야 합니다. 입력된 값: 20000',
            '업종 코드는 빈 문자열일 수 없습니다.',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async getStoresWithinRadius(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', ParseFloatPipe) radius: number,
    @Query('sector') sector?: string,
  ): Promise<StoreWithinRadiusRow[]> {
    // 좌표 범위 검증
    if (lat < -90 || lat > 90) {
      throw new BadRequestException(
        `위도는 -90 ~ 90 범위여야 합니다. 입력된 값: ${lat}`,
      );
    }

    if (lng < -180 || lng > 180) {
      throw new BadRequestException(
        `경도는 -180 ~ 180 범위여야 합니다. 입력된 값: ${lng}`,
      );
    }

    // 반경 범위 검증
    if (radius < 1) {
      throw new BadRequestException(
        `반경은 최소 1미터 이상이어야 합니다. 입력된 값: ${radius}`,
      );
    }

    if (radius > 10000) {
      throw new BadRequestException(
        `반경은 최대 10,000미터(10km) 이하여야 합니다. 입력된 값: ${radius}`,
      );
    }

    // 업종 코드 검증 (선택값이지만 빈 문자열은 제외)
    if (sector !== undefined && sector.trim() === '') {
      throw new BadRequestException('업종 코드는 빈 문자열일 수 없습니다.');
    }

    return this.spatialService.findStoresWithinRadius(lat, lng, radius, sector);
  }

  /**
   * 반경 내 점포 목록 조회 (개선된 버전: 거리, 페이징, 정렬 지원)
   *
   * GET /spatial/stores-within-radius-enhanced
   */
  @Get('stores-within-radius-enhanced')
  @ApiOperation({
    summary: '반경 내 점포 목록 조회 (개선된 버전)',
    description:
      '거리 정보, 페이징, 정렬 옵션을 지원하는 개선된 반경 내 점포 조회 API입니다.',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    type: Number,
    description: '중심점 위도 (-90 ~ 90)',
    example: 37.5636,
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    type: Number,
    description: '중심점 경도 (-180 ~ 180)',
    example: 126.9826,
  })
  @ApiQuery({
    name: 'radius',
    required: true,
    type: Number,
    description: '반경 (미터 단위, 1 ~ 10000)',
    example: 500,
  })
  @ApiQuery({
    name: 'sector',
    required: false,
    type: String,
    description: '업종 코드 (선택값)',
    example: '일반음식점',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '페이지 번호 (1부터 시작)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지당 항목 수 (1 ~ 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      'distance_asc',
      'distance_desc',
      'open_date_desc',
      'open_date_asc',
      'sector_asc',
    ],
    description: '정렬 옵션',
    example: 'distance_asc',
  })
  @ApiResponse({
    status: 200,
    description: '반경 내 점포 목록 (페이징 및 메타데이터 포함)',
  })
  async getStoresWithinRadiusEnhanced(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', ParseFloatPipe) radius: number,
    @Query('sector') sector?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy')
    sortBy?:
      | 'distance_asc'
      | 'distance_desc'
      | 'open_date_desc'
      | 'open_date_asc'
      | 'sector_asc',
  ) {
    // 좌표 범위 검증
    if (lat < -90 || lat > 90) {
      throw new BadRequestException(
        `위도는 -90 ~ 90 범위여야 합니다. 입력된 값: ${lat}`,
      );
    }

    if (lng < -180 || lng > 180) {
      throw new BadRequestException(
        `경도는 -180 ~ 180 범위여야 합니다. 입력된 값: ${lng}`,
      );
    }

    // 반경 범위 검증
    if (radius < 1) {
      throw new BadRequestException(
        `반경은 최소 1미터 이상이어야 합니다. 입력된 값: ${radius}`,
      );
    }

    if (radius > 10000) {
      throw new BadRequestException(
        `반경은 최대 10,000미터(10km) 이하여야 합니다. 입력된 값: ${radius}`,
      );
    }

    return this.spatialService.findStoresWithinRadiusEnhanced(
      lat,
      lng,
      radius,
      sector,
      page || 1,
      limit || 20,
      sortBy || 'open_date_desc',
    );
  }

  /**
   * 쿼리 실행 계획 분석 엔드포인트
   *
   * GET /spatial/explain
   *
   * 인덱스 사용 여부 및 성능 분석을 위한 EXPLAIN ANALYZE 결과를 반환합니다.
   */
  @Get('explain')
  @ApiOperation({
    summary: '쿼리 실행 계획 분석',
    description:
      '공간 쿼리의 실행 계획을 분석하여 인덱스 사용 여부 및 성능을 확인합니다.',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    type: Number,
    description: '중심점 위도 (-90 ~ 90)',
    example: 37.5636,
  })
  @ApiQuery({
    name: 'lng',
    required: true,
    type: Number,
    description: '중심점 경도 (-180 ~ 180)',
    example: 126.9826,
  })
  @ApiQuery({
    name: 'radius',
    required: true,
    type: Number,
    description: '반경 (미터 단위, 1 ~ 10000)',
    example: 500,
  })
  @ApiQuery({
    name: 'sector',
    required: false,
    type: String,
    description: '업종 코드 (선택값)',
    example: '일반음식점',
  })
  @ApiResponse({
    status: 200,
    description: '쿼리 실행 계획',
  })
  async explainQuery(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', ParseFloatPipe) radius: number,
    @Query('sector') sector?: string,
  ) {
    return this.spatialService.explainQuery(lat, lng, radius, sector);
  }

  /**
   * 데이터베이스 상태 확인용 디버깅 엔드포인트
   *
   * GET /spatial/debug
   *
   * location이 있는 데이터 개수와 샘플 좌표를 확인할 수 있습니다.
   */
  @Get('debug')
  @ApiOperation({
    summary: '공간 데이터 디버깅 정보',
    description: '데이터베이스에 저장된 location 데이터의 상태를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '디버깅 정보',
  })
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
    return await this.spatialService.getDebugInfo();
  }
}
