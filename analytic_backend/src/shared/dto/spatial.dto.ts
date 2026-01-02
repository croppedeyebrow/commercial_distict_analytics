import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 공간 분석 API용 Request/Response DTO
 *
 * SpatialModule의 API 엔드포인트에서 사용하는 표준 DTO입니다.
 */

/**
 * 정렬 옵션 열거형
 */
export enum SortOption {
  /** 거리순 정렬 (가까운 순) */
  DISTANCE_ASC = 'distance_asc',
  /** 거리순 정렬 (먼 순) */
  DISTANCE_DESC = 'distance_desc',
  /** 개업일순 정렬 (최신순) */
  OPEN_DATE_DESC = 'open_date_desc',
  /** 개업일순 정렬 (오래된 순) */
  OPEN_DATE_ASC = 'open_date_asc',
  /** 업종별 정렬 */
  SECTOR_ASC = 'sector_asc',
}

/**
 * 반경 내 점포 조회 요청 DTO
 */
export class StoresWithinRadiusRequestDto {
  @ApiProperty({
    description: '중심점 위도 (-90 ~ 90)',
    example: 37.5636,
    minimum: -90,
    maximum: 90,
  })
  lat: number;

  @ApiProperty({
    description: '중심점 경도 (-180 ~ 180)',
    example: 126.9826,
    minimum: -180,
    maximum: 180,
  })
  lng: number;

  @ApiProperty({
    description: '반경 (미터 단위, 1 ~ 10000)',
    example: 500,
    minimum: 1,
    maximum: 10000,
  })
  radius: number;

  @ApiProperty({
    description: '업종 코드 (선택값)',
    example: '일반음식점',
    required: false,
  })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiProperty({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '페이지당 항목 수 (1 ~ 100)',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: '정렬 옵션',
    enum: SortOption,
    example: SortOption.DISTANCE_ASC,
    default: SortOption.OPEN_DATE_DESC,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOption)
  sortBy?: SortOption = SortOption.OPEN_DATE_DESC;
}

/**
 * 점포 정보 (거리 포함)
 */
export class StoreWithDistanceDto {
  @ApiProperty({ description: '점포 ID', example: '12345' })
  id: string;

  @ApiProperty({ description: '점포명', example: '스타벅스 강남점' })
  storeName: string;

  @ApiProperty({
    description: '업종 코드',
    example: '일반음식점',
    nullable: true,
  })
  sector: string | null;

  @ApiProperty({
    description: '주소',
    example: '서울특별시 강남구 테헤란로 123',
    nullable: true,
  })
  address: string | null;

  @ApiProperty({
    description: 'GeoJSON 형식의 위치 정보',
    example: '{"type":"Point","coordinates":[126.9826,37.5636]}',
  })
  location: string;

  @ApiProperty({
    description: '중심점으로부터의 거리 (미터)',
    example: 125.5,
  })
  distance: number;

  @ApiProperty({
    description: '개업일',
    example: '2023-01-15',
    nullable: true,
  })
  openDate?: string | null;
}

/**
 * 반경 내 점포 조회 응답 DTO
 */
export class StoresWithinRadiusResponseDto {
  @ApiProperty({
    description: '점포 목록',
    type: [StoreWithDistanceDto],
  })
  stores: StoreWithDistanceDto[];

  @ApiProperty({
    description: '전체 점포 수 (페이징 적용 전)',
    example: 150,
  })
  totalCount: number;

  @ApiProperty({
    description: '현재 페이지 번호',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: '페이지당 항목 수',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: '전체 페이지 수',
    example: 8,
  })
  totalPages: number;

  @ApiProperty({
    description: '다음 페이지 존재 여부',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: '이전 페이지 존재 여부',
    example: false,
  })
  hasPrev: boolean;
}
