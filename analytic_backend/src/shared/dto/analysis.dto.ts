import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * 분석 API용 Request/Response DTO
 *
 * AnalysisModule의 API 엔드포인트에서 사용하는 표준 DTO입니다.
 * ValidationPipe의 whitelist 기능을 위해 class-validator 데코레이터를 사용합니다.
 */

/**
 * 생존 기간 분석 요청 DTO
 *
 * GET /analysis/survival
 */
export class SurvivalRequestDto {
  /**
   * 업종 코드 (선택값)
   * 예: "C10" (카페), "I20" (음식점)
   * 지정하지 않으면 전체 업종 분석
   */
  @ApiProperty({
    description:
      '업종 코드 (예: C10=카페, I20=음식점). 지정하지 않으면 전체 업종 분석',
    example: 'C10',
    required: false,
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsString() // 문자열 타입 검증
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsOptional() // 선택값임을 명시 (ValidationPipe whitelist를 위해 필요)
  sector?: string;
}

/**
 * 생존 기간 분석 응답 DTO
 *
 * 업종별 평균 생존 일수와 샘플 크기를 반환합니다.
 */
export class SurvivalResponseDto {
  /**
   * 업종 코드
   */
  @ApiProperty({ description: '업종 코드', example: 'C10' })
  sector: string;

  /**
   * 평균 생존 일수 (소수점 2자리)
   */
  @ApiProperty({
    description: '평균 생존 일수 (소수점 2자리)',
    example: 365.5,
  })
  avgDurationDays: number;

  /**
   * 분석에 사용된 폐업 점포 개수 (샘플 크기)
   */
  @ApiProperty({
    description: '분석에 사용된 폐업 점포 개수',
    example: 100,
  })
  sampleSize: number;
}

/**
 * 경쟁 강도 분석 요청 DTO
 *
 * GET /analysis/competition
 *
 * 주의: 검증은 AnalysisController에서 직접 수행합니다.
 * - 위도: -90 ~ 90 범위
 * - 경도: -180 ~ 180 범위
 * - 반경: 1 ~ 10000 미터 범위
 * - 업종 코드: 필수값
 */
export class CompetitionRequestDto {
  /**
   * 위도 (필수값)
   * 범위: -90 ~ 90
   * 컨트롤러에서 ParseFloatPipe로 변환 및 검증됨
   */
  @ApiProperty({
    description: '위도 (-90 ~ 90)',
    example: 37.5665,
    minimum: -90,
    maximum: 90,
  })
  lat: number;

  /**
   * 경도 (필수값)
   * 범위: -180 ~ 180
   * 컨트롤러에서 ParseFloatPipe로 변환 및 검증됨
   */
  @ApiProperty({
    description: '경도 (-180 ~ 180)',
    example: 126.978,
    minimum: -180,
    maximum: 180,
  })
  lon: number;

  /**
   * 반경 (미터 단위, 필수값)
   * 최소값: 1, 최대값: 10000 (10km)
   * 컨트롤러에서 ParseFloatPipe로 변환 및 검증됨
   */
  @ApiProperty({
    description: '반경 (미터, 1 ~ 10000)',
    example: 500,
    minimum: 1,
    maximum: 10000,
  })
  radiusMeters: number;

  /**
   * 업종 코드 (필수값)
   * 예: "C10" (카페), "I20" (음식점)
   * 컨트롤러에서 검증됨
   */
  @ApiProperty({
    description: '업종 코드 (예: C10=카페, I20=음식점)',
    example: 'C10',
  })
  sector: string;
}

/**
 * 경쟁 강도 분석 응답 DTO
 *
 * 특정 위치 반경 내 동일 업종 점포 개수를 반환합니다.
 */
export class CompetitionResponseDto {
  /**
   * 반경 내 동일 업종 점포 개수
   */
  @ApiProperty({
    description: '반경 내 동일 업종 점포 개수',
    example: 15,
  })
  totalCount: number;

  /**
   * 분석한 업종 코드
   */
  @ApiProperty({
    description: '분석한 업종 코드',
    example: 'C10',
  })
  sector: string;
}
