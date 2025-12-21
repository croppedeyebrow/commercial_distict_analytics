import {
  Controller,
  Get,
  Query,
  ParseFloatPipe,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { AnalysisService } from './analysis.service';
import {
  SurvivalRequestDto,
  SurvivalResponseDto,
  CompetitionResponseDto,
} from '../../shared/dto/analysis.dto';

/**
 * 상권 분석 API 컨트롤러
 *
 * 클라이언트로부터 분석 요청을 받아 AnalysisService를 호출합니다.
 * 엔드포인트: /analysis
 */
@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * 점포 개업 현황 스냅샷 API
   *
   * GET /analysis/stores/openings
   *
   * @param limit 조회할 최대 개수 (선택값)
   * @returns 최근 개업 점포 통계
   *
   * 캐싱: 300초 (5분) - 자주 변하지 않는 데이터이므로 짧은 캐시 적용
   */
  @Get('stores/openings')
  @ApiOperation({
    summary: '점포 개업 현황 스냅샷',
    description: '최근 개업한 점포들의 기본 통계를 제공합니다.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '조회할 최대 개수 (기본값: 50)',
  })
  @ApiResponse({
    status: 200,
    description: '점포 개업 현황 통계',
    schema: {
      type: 'object',
      properties: {
        sampleSize: { type: 'number', description: '조회된 점포 개수' },
        latestOpenedAt: {
          type: 'string',
          format: 'date',
          description: '가장 최근 개업일',
        },
        sectors: {
          type: 'array',
          items: { type: 'string' },
          description: '중복 제거된 업종 목록',
        },
      },
    },
  })
  @CacheKey('analysis-stores-openings')
  @CacheTTL(300)
  async getStoreSnapshot(@Query('limit') limit?: string) {
    return this.analysisService.getStoreOpeningSnapshot(
      limit ? Number(limit) : undefined,
    );
  }

  /**
   * 평균 생존 기간 분석 API
   *
   * GET /analysis/survival
   *
   * @param sector 업종 코드 (선택값, 없으면 전체 업종 분석)
   * @returns 업종별 평균 생존 일수
   *
   * 캐싱: 3600초 (1시간) - 계산 비용이 크므로 긴 캐시 적용
   *
   * 사용 예시:
   * - GET /analysis/survival (전체 업종)
   * - GET /analysis/survival?sector=C10 (카페만)
   */
  @Get('survival')
  @ApiOperation({
    summary: '평균 생존 기간 분석',
    description:
      '폐업한 점포들의 개업일과 폐업일을 비교하여 평균 생존 일수를 계산합니다.',
  })
  @ApiQuery({
    name: 'sector',
    required: false,
    type: String,
    description:
      '업종 코드 (예: C10=카페, I20=음식점). 지정하지 않으면 전체 업종 분석',
  })
  @ApiResponse({
    status: 200,
    description: '업종별 평균 생존 일수',
    type: [SurvivalResponseDto],
  })
  @UseInterceptors(CacheInterceptor) // Redis 캐시 인터셉터 적용
  @CacheKey('analysis-survival')
  @CacheTTL(3600) // 1시간 캐시
  async getSurvivalDuration(@Query() dto: SurvivalRequestDto) {
    return this.analysisService.calculateSurvival(dto.sector);
  }

  /**
   * 경쟁 강도 분석 API
   *
   * GET /analysis/competition
   *
   * @param lat 위도 (필수값, ParseFloatPipe로 자동 변환)
   * @param lng 경도 (필수값, ParseFloatPipe로 자동 변환)
   * @param radiusMeters 반경 미터 (필수값, ParseFloatPipe로 자동 변환)
   * @param sector 업종 코드 (필수값)
   * @returns 해당 위치 반경 내 동일 업종 점포 개수
   *
   * 캐싱: 미적용 - 좌표 기반 실시간 쿼리이므로 캐싱하지 않음
   *
   * 사용 예시:
   * GET /analysis/competition?lat=37.5&lon=127.0&radiusMeters=500&sector=C10
   */
  @Get('competition')
  @ApiOperation({
    summary: '경쟁 강도 분석',
    description:
      '특정 위치(좌표)와 반경 내에 있는 동일 업종 점포의 개수를 계산합니다.',
  })
  @ApiQuery({
    name: 'lat',
    type: Number,
    description: '위도 (-90 ~ 90)',
    example: 37.5665,
  })
  @ApiQuery({
    name: 'lon',
    type: Number,
    description: '경도 (-180 ~ 180)',
    example: 126.978,
  })
  @ApiQuery({
    name: 'radiusMeters',
    type: Number,
    description: '반경 (미터, 1 ~ 10000)',
    example: 500,
  })
  @ApiQuery({
    name: 'sector',
    type: String,
    description: '업종 코드 (예: C10=카페, I20=음식점)',
    example: 'C10',
  })
  @ApiResponse({
    status: 200,
    description: '반경 내 동일 업종 점포 개수',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 파라미터',
  })
  async getCompetitionCount(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lon', ParseFloatPipe) lon: number,
    @Query('radiusMeters', ParseFloatPipe) radiusMeters: number,
    @Query('sector') sector: string,
  ) {
    // 좌표 범위 검증
    if (lat < -90 || lat > 90) {
      throw new BadRequestException('위도는 -90 ~ 90 범위여야 합니다.');
    }
    if (lon < -180 || lon > 180) {
      throw new BadRequestException('경도는 -180 ~ 180 범위여야 합니다.');
    }

    // 반경 범위 검증
    if (radiusMeters < 1 || radiusMeters > 10000) {
      throw new BadRequestException('반경은 1 ~ 10000 미터 범위여야 합니다.');
    }

    // 업종 코드 검증
    if (!sector || sector.trim() === '') {
      throw new BadRequestException('업종 코드는 필수입니다.');
    }

    return this.analysisService.getCompetition(lat, lon, radiusMeters, sector);
  }

  /**
   * 분석 데이터 상태 확인용 디버깅 엔드포인트
   *
   * GET /analysis/debug
   *
   * 각 분석 기능의 데이터 상태를 확인할 수 있습니다.
   */
  @Get('debug')
  @ApiOperation({
    summary: '분석 데이터 디버깅 정보',
    description:
      '개업 현황, 생존 기간 분석, 경쟁 강도 분석에 사용되는 데이터의 상태를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '디버깅 정보',
    schema: {
      type: 'object',
      properties: {
        storeOpeningSnapshot: {
          type: 'object',
          properties: {
            totalStores: { type: 'number' },
            recentStores: { type: 'number' },
            sectors: { type: 'array', items: { type: 'string' } },
          },
        },
        survivalAnalysis: {
          type: 'object',
          properties: {
            totalClosedStores: { type: 'number' },
            closedStoresBySector: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sector: { type: 'string' },
                  count: { type: 'number' },
                },
              },
            },
            sectorsWithData: { type: 'array', items: { type: 'string' } },
          },
        },
        competitionAnalysis: {
          type: 'object',
          properties: {
            storesWithLocation: { type: 'number' },
            storesWithoutLocation: { type: 'number' },
            sampleLocations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                  sector: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getDebugInfo() {
    return this.analysisService.getDebugInfo();
  }
}
