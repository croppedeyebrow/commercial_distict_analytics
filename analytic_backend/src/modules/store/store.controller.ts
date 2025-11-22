import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { StoreService } from './store.service';

/**
 * 점포 데이터 REST API 컨트롤러
 *
 * 클라이언트로부터 점포 조회 요청을 받아 StoreService를 호출합니다.
 * 엔드포인트: /stores
 */
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  /**
   * 점포 목록 조회 API
   *
   * GET /stores
   *
   * @param pagination 페이징 정보 (page, limit)
   * @param sector 업종 코드 (선택값, 있으면 해당 업종만 필터링)
   * @returns 점포 목록
   *
   * 사용 예시:
   * - GET /stores?limit=10 (최근 개업한 점포 10개)
   * - GET /stores?sector=C10&limit=20 (카페 업종 점포 20개)
   */
  @Get()
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sector') sector?: string,
  ) {
    // 업종 필터가 있으면 업종별 조회, 없으면 최근 개업 순 조회
    if (sector) {
      return this.storeService.findAllBySector(sector);
    }
    return this.storeService.findLatest(limit);
  }

  /**
   * 폐업한 점포 목록 조회 API
   *
   * GET /stores/closed
   *
   * @param sector 업종 코드 (선택값)
   * @returns 폐업한 점포 목록
   *
   * 사용 예시:
   * - GET /stores/closed (모든 폐업 점포)
   * - GET /stores/closed?sector=C10 (카페 업종 폐업 점포만)
   */
  @Get('closed')
  async listClosed(@Query('sector') sector?: string) {
    return this.storeService.findClosedStores(sector);
  }
}
