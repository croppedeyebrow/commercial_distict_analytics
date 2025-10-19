// src/test/test.controller.ts

import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Controller('test')
export class TestController {
  private counter = 0;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    console.log('[TEST] CacheManager 주입됨:', !!this.cacheManager);
  }

  @Get('cache')
  async getCacheData() {
    const cacheKey = 'test-cache-key';

    // 캐시에서 데이터 확인
    console.log(`[TEST] 캐시 키 "${cacheKey}" 조회 중...`);
    const cachedData = await this.cacheManager.get(cacheKey);
    console.log(`[TEST] 캐시 조회 결과:`, cachedData);

    if (cachedData) {
      console.log('[TEST] 캐시된 데이터 반환');
      return cachedData;
    }

    // 캐시에 없으면 새로 생성
    this.counter++;
    const timestamp = new Date().toISOString();
    console.log(`[TEST] API 호출됨: ${this.counter}회, 시간: ${timestamp}`);

    const data = {
      count: this.counter,
      timestamp: timestamp,
      message: '이 데이터는 5분(TTL) 동안 Redis에 캐싱됩니다.',
    };

    // 캐시에 저장 (5분 = 300초)
    try {
      console.log('[TEST] 캐시 저장 시도 중...');
      await this.cacheManager.set(cacheKey, data, 300000); // 5분 = 300,000ms
      console.log('[TEST] 데이터를 캐시에 저장 완료');

      // 저장 후 즉시 확인
      const verifyData = await this.cacheManager.get(cacheKey);
      console.log('[TEST] 저장 후 확인:', verifyData);
    } catch (error) {
      console.error('[TEST] 캐시 저장 실패:', error);
    }

    return data;
  }

  @Get('redis-test')
  async testRedisConnection() {
    try {
      // Redis 연결 테스트
      await this.cacheManager.set('test-connection', 'success', 10);
      const result = await this.cacheManager.get('test-connection');

      return {
        status: 'success',
        message: 'Redis 연결 성공',
        testResult: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Redis 연결 실패',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
