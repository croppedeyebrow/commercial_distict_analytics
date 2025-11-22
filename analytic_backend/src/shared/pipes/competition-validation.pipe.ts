import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/**
 * 경쟁 강도 분석 요청 검증 파이프
 *
 * 좌표와 반경 값의 유효성을 검증합니다.
 */
@Injectable()
export class CompetitionValidationPipe implements PipeTransform {
  transform(value: {
    lat: number;
    lon: number;
    radiusMeters: number;
    sector: string;
  }): {
    lat: number;
    lon: number;
    radiusMeters: number;
    sector: string;
  } {
    // 위도 검증
    if (value.lat < -90 || value.lat > 90) {
      throw new BadRequestException('위도는 -90 ~ 90 범위여야 합니다.');
    }

    // 경도 검증
    if (value.lon < -180 || value.lon > 180) {
      throw new BadRequestException('경도는 -180 ~ 180 범위여야 합니다.');
    }

    // 반경 검증
    if (value.radiusMeters < 1 || value.radiusMeters > 10000) {
      throw new BadRequestException('반경은 1 ~ 10000 미터 범위여야 합니다.');
    }

    // 업종 코드 검증
    if (!value.sector || value.sector.trim() === '') {
      throw new BadRequestException('업종 코드는 필수입니다.');
    }

    return value;
  }
}
