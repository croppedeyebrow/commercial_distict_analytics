/**
 * 표준 에러 응답 DTO
 *
 * 모든 API 에러 응답에 일관된 형식을 제공합니다.
 */
export class ErrorResponseDto {
  /**
   * HTTP 상태 코드
   */
  statusCode: number;

  /**
   * 에러 메시지
   */
  message: string | string[];

  /**
   * 에러 발생 시간 (ISO 8601 형식)
   */
  timestamp: string;

  /**
   * 에러 발생 경로
   */
  path: string;

  /**
   * 추가 에러 정보 (선택값)
   */
  details?: unknown;
}
