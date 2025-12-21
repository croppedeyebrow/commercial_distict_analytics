import { Controller, Get, Query, ParseFloatPipe } from '@nestjs/common';
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
    description:
      '특정 좌표를 중심으로 지정된 반경(미터) 내에 있는 점포 목록을 조회합니다. PostGIS를 사용하여 공간 인덱스를 활용한 고성능 쿼리를 수행합니다.',
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
    description: '잘못된 파라미터 (좌표 범위 초과, 반경 범위 초과 등)',
  })
  async getStoresWithinRadius(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', ParseFloatPipe) radius: number,
    @Query('sector') sector?: string,
  ): Promise<StoreWithinRadiusRow[]> {
    return this.spatialService.findStoresWithinRadius(lat, lng, radius, sector);
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  async getDebugInfo(): Promise<any> {
    return await this.spatialService.getDebugInfo();
  }
}
