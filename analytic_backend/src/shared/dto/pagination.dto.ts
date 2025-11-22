/**
 * 페이징 쿼리 파라미터 DTO
 *
 * API 요청에서 page와 limit 파라미터를 받을 때 사용합니다.
 *
 * ============================================
 * 왜 이 방식이 오류 없이 작동하는가?
 * ============================================
 *
 * 1. 이전 방식의 문제점:
 *    - @Transform, @Type 데코레이터를 사용했을 때:
 *      * TransformFnParams의 value가 any 타입으로 추론됨
 *      * TypeScript/ESLint가 "Unsafe call of error type" 경고 발생
 *      * 타입 단언을 해도 계속 경고가 발생
 *
 * 2. 현재 방식의 해결책:
 *    - DTO는 단순히 타입만 정의 (데코레이터 없음)
 *    - 컨트롤러에서 NestJS의 내장 파이프를 직접 사용:
 *      * ParseIntPipe: 쿼리 파라미터를 숫자로 변환 (타입 안전)
 *      * DefaultValuePipe: 기본값 설정
 *    - 파이프는 NestJS 런타임에서 처리되므로 타입 오류 없음
 *
 * 3. 작동 원리:
 *    - HTTP 요청: GET /stores?page=1&limit=10
 *    - 쿼리 파라미터는 기본적으로 문자열: "1", "10"
 *    - ParseIntPipe가 실행되어 숫자로 변환: 1, 10
 *    - 변환된 값이 컨트롤러 메서드 파라미터로 전달됨
 *    - TypeScript는 이미 숫자 타입으로 인식하므로 타입 오류 없음
 *
 * 4. 장점:
 *    - 타입 안전성: 파이프가 런타임에 타입 변환 보장
 *    - 간단함: 복잡한 데코레이터 체인 불필요
 *    - 명확함: 컨트롤러에서 변환 로직이 명시적으로 보임
 *    - 오류 없음: ESLint/TypeScript 경고 없음
 *
 * 사용 예시:
 * - GET /stores?page=1&limit=10
 * - GET /stores?limit=20 (page는 기본값 1 사용)
 *
 * 참고: 실제 사용은 store.controller.ts에서 다음과 같이 처리됩니다:
 * @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
 * @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
 */
export class PaginationQueryDto {
  /**
   * 페이지 번호 (기본값: 1)
   * 최소값: 1
   */
  page?: number;

  /**
   * 페이지당 항목 수 (기본값: 20)
   * 최소값: 1, 최대값: 100
   */
  limit?: number;
}
