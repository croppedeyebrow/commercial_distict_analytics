# 개발 과정 기록.(로컬 개발)

---

## ~ 2025-10-18 : 파이썬 ETL 작업 진행.

- 파이썬 환경 설정.
- "서울시 식품업소 목록.csv" 파일 다운로드.
- "서울시 식품업소 목록.csv" 파일 postgres DB에 적재.
- 지오코딩 작업 진행.(현재 2000건)

---

## 2025-10-19

### 🚀 1단계: 데이터 기반 확보 및 준비 (세부 계획).

> Nest.js와 PostGIS가 고성능으로 통신할 수 있도록 DB 환경을 최종 점검하고, 분석에 필요한 핵심 쿼리를 확정

#### 1.1 지오코딩 완료 및 품질 검증 (2,000건 유지)

- 목표
  > 2,000개의 레코드가 PostGIS location 컬럼에 정확한 좌표를 가지고 있는지 최종 확인.
- 세부 작업.
  - 1.  잔여 데이터 확인 : 몇 건을 더 변환해야 하는지 확인
  - 2.  데이터 품질 확인 : 변환된 2,000건의 location 컬럼에 POINT(...) 형태의 데이터가 들어 있으며, PostGIS의 SRID가 4326으로 설정되어 있는지 확인

#### 1.2 Redis 서버 구축.

- 목표

  > Nest.js 백엔드의 캐싱 기능을 위해 Redis 인스턴스를 준비.

- 세부 작업.

  - 도커를 사용하여, 로컬 환경에서 Redis 서버 개발.

    > 로컬에 직접 설치한 것처럼 localhost:6379로 접속할 수 있어 개발 경험을 유지하면서도, WSL 환경 오류를 완벽하게 회피.

    - 1.  Redis 컨테이너 실행.
      - docker run --name redis_local_dev -d -p 6379:6379 redis:6-alpine
        > 이 명령어는 Redis를 실행하고 컨테이너의 6379 포트를 Windows (로컬) 환경의 6379 포트에 연결합니다. 따라서 Nest.js는 Redis가 도커 컨테이너 안에 있는지 알 필요 없이 localhost:6379로 접속
        - 이미지를 생성하고 도커에서 레디스를 실행하며, 자동으로 로컬 포트와 연결.
        - Redis 서버 상태 확인 : docker ps -f name=redis_local_dev
          - STATUS : Up X seconds 표시
          - PORTS : 0.0.0.0:6379->6379/tcp
    - 2.  Redis 서버-nest.js 연동.

      - nest.js 프로젝트 만들기.

        - nest 전역 설치. : npm install -g @nestjs/cli
        - 환경 변수 확인(선택 사항)

          - Node.js 설치 경로 확인인 : npm root -g
          - 시스템 환경변수 편집에서 Path변수에 npm 전역 경로가 있는지 확인.

        - 최종 확인 : nest --version.

      > nest.js 작업의 디렉토리 이동 : cd analytics-backend.

      - nest.js 프로젝트 생성. : nest new analytics-backend -> 패키지 매니저 npm 사용.

        - 프로젝트 디렉토리 이동. : cd analytics-backend
        - 패키지 설치 확인 : npm uninstall cache-manager-redis-store && npm install cache-manager-redis-yet
        - src/app.module.ts 파일을 수정하여 **CacheModule**을 Redis와 연결하고, 이를 전역으로 사용 가능하도록 설정.
          - 추가 패키지 설치 : npm install @nestjs/typeorm @nestjs/config typeorm pg.
        - .env에 redis 정보 추가.
        - nest.js 경로에서 애플리케이션 실행 : npm run start:dev.

      - redis 임시 테스트 컨트롤러 생성.
        - 컨트롤러 생성 : nest generate controller test
        - 캐싱 적용 : src/test/test.controller.ts 파일을 수정하여 @CacheInterceptor를 적용.

#### 1.2.1 Redis 캐싱 문제 해결 과정

**문제 상황:**

- Redis 서버는 정상 작동 (docker exec -it "redis_local_dev" redis-cli ping → PONG)
- NestJS에서 캐시 저장은 성공하지만 조회 시 `undefined` 반환
- 캐시가 저장되자마자 사라지는 현상 발생

**해결 과정:**

1. **패키지 호환성 문제 해결**

   ```bash
   # 기존 패키지 제거 및 호환성 좋은 패키지로 교체
   npm uninstall cache-manager-redis-store
   npm install cache-manager-redis-yet
   ```

2. **캐시 설정 방식 변경**

   - `CacheInterceptor` → 수동 캐시 관리로 변경
   - `@Inject(CACHE_MANAGER)`를 통한 직접 캐시 제어

3. **TTL 단위 문제 발견 및 해결**

   ```typescript
   // ❌ 잘못된 설정 (300ms = 0.3초)
   await this.cacheManager.set(cacheKey, data, 300);

   // ✅ 올바른 설정 (300,000ms = 5분)
   await this.cacheManager.set(cacheKey, data, 300000);
   ```

**최종 해결책:**

- `cache-manager`의 `set()` 메서드는 TTL을 **밀리초 단위**로 받음
- 300은 300ms(0.3초)로 거의 즉시 만료되어 캐싱이 작동하지 않았음
- 300,000ms(5분)로 수정하여 정상 작동 확인

**결과:**

- 캐시 저장/조회 정상 작동
- 첫 번째 호출: 데이터 생성 및 캐시 저장
- 두 번째 호출: 캐시된 데이터 반환 (카운터 증가 없음)

#### 1.2.2 Nest 서버 실행 및 Redis/캐시 검증 절차

1. **Nest 서버 실행**

   ```bash
   cd analytic_backend
   npm run start:dev
   ```

   - 콘솔에서 `[TEST] CacheManager 주입됨: true`, `Nest application successfully started` 로그 확인

2. **Redis 연결 상태 점검 (`/test/redis-test`)**

   - 브라우저 또는 API 툴에서 `http://localhost:3000/test/redis-test` 호출
   - 정상 응답 예시:
     ```json
     {
       "status": "success",
       "message": "Redis 연결 성공",
       "testResult": "success",
       "timestamp": "2025-11-15T13:46:23.316Z"
     }
     ```
   - 이 응답이 나오면 Redis 컨테이너(`redis_local_dev`)와 Nest 서버 간 연결이 정상

3. **캐시 동작 확인 (`/test/cache`)**
   - 동일한 엔드포인트를 연속으로 호출하여 `count` 값이 증가하지 않는지 확인
   - 첫 호출
     - 응답: `{"count":1,"timestamp":...}`
     - 서버 로그: `[TEST] 캐시 키 "test-cache-key" 조회 중... → 캐시 조회 결과: undefined → API 호출됨 → 저장 후 확인`
   - 두 번째 호출
     - 응답: `{"count":1,"timestamp":...}` (동일 값 유지)
     - 서버 로그: `[TEST] 캐시된 데이터 반환`
   - TTL: 300,000ms (5분) → 5분 내 재호출 시 동일 응답 유지

> 요약: Nest 서버 기동 → `/test/redis-test`로 Redis 연결 확인 → `/test/cache` 반복 호출로 캐시 히트 여부 확인.

---

## 백엔드

### 1. 구조 개편 및 모듈화

- `analytic_backend/src` 구조 정리
  - `config/`: `app-config.module.ts`, `database.config.ts`, `redis.config.ts` 등 환경 설정 파일 분리
  - `modules/`: `store`, `analysis`, `spatial`, `test` 등 도메인별 모듈 생성
  - `shared/`: `dto/pagination.dto.ts`, `interceptors/logging.interceptor.ts` 등 공통 자원 위치
  - `infra/`: 커스텀 Repository 폴더 준비
- `app.module.ts` 정리
  - `AppConfigModule` 도입으로 ConfigModule 설정 일원화
  - `TypeOrmModule.forRoot(databaseConfig())`와 `CacheModule.registerAsync(redisConfig)` 적용
  - `StoreModule`, `AnalysisModule`, `SpatialModule`, `TestModule` import
- `main.ts` 에 전역 로깅 인터셉터 추가

### 2. Store 도메인

- `store.entity.ts` 구성 (SRID=4326 geometry 컬럼 포함)
- `store.service.ts`: 최근 데이터 조회 API (`findLatest`)
- `store.controller.ts`: `/stores` 엔드포인트 (limit 기반 조회)
- TypeORM 모듈 등록 및 StoreModule 구성

### 3. Analysis 도메인

- `analysis.service.ts`: `StoreService` 기반 지표 계산 (`getStoreOpeningSnapshot`)
- `analysis.controller.ts`: `/analysis/stores/openings` API, Redis 캐시 TTL 적용
- AnalysisModule에서 StoreModule 의존성 주입

### 4. Spatial 도메인

- `spatial.service.ts`: PostGIS Raw Query (`ST_DWithin`) 실행, 타입 안정성 보강
- `spatial.controller.ts`: `/spatial/stores-within-radius` API에 `ParseFloatPipe` + 명시적 반환 타입 적용
- SpatialModule 구성

### 5. 캐시/테스트 모듈

- `test.controller.ts` → `/test/cache`, `/test/redis-test` 등 상태 확인 API 유지
- TestModule 생성하여 app.module에서 import

### 6. 공통 DTO 및 유틸

- `PaginationQueryDto` 생성, `class-transformer` + `class-validator` 기반 안전한 숫자 변환 구현
- `logging.interceptor.ts`로 요청당 수행 시간 로깅
- NPM 의존성에 `class-transformer`, `class-validator` 추가 (설치 필요)

### 7. 기타

- `package.json` dependency 보강 후 `npm install` 필요
- `tsconfig`, `nest-cli` 기본 구조는 유지
- 추후 `ValidationPipe` 적용 시 `PaginationQueryDto` 등 활용 예정

#### 1.3 핵심 지표 쿼리 작성(SQL 확정)

---

## 2025-11-22

### 1. PostgreSQL 연결 및 환경 변수 설정 문제 해결

#### 1.1 .env 파일 경로 문제 해결

**문제:**

- NestJS 서버 시작 시 PostgreSQL 인증 실패 (`password authentication failed`)
- `app-config.module.ts`에서 `.env` 파일을 찾지 못함

**원인:**

- `envFilePath`가 `analytic_backend/.env`만 가리키고 있었으나, 실제 `.env` 파일은 프로젝트 루트(`district_analytics/.env`)에 위치

**해결:**

- `app-config.module.ts` 수정: 프로젝트 루트와 `analytic_backend` 루트 모두에서 `.env` 파일을 찾도록 경로 배열 설정
  ```typescript
  envFilePath: [
    join(__dirname, '../../../.env'), // 프로젝트 루트
    join(__dirname, '../../.env'), // analytic_backend 루트 (백업)
  ],
  ```

**결과:**

- PostgreSQL 연결 정상 작동
- 환경 변수 로드 성공

### 2. TypeORM 스키마 동기화 문제 해결

#### 2.1 스키마 동기화 실패 원인 분석

**문제:**

- 서버 시작 시 TypeORM이 스키마 동기화를 시도하지만 실패
- 에러: `"openDate" 열(해당 릴레이션 "store")의 자료 가운데 null 값이 있습니다`
- 이후 `"location" 열(해당 릴레이션 "store")의 자료 가운데 null 값이 있습니다` 에러도 발생

**원인:**

- 기존 데이터베이스에 필수 컬럼(`sector`, `openDate`, `location`)이 `null`인 레코드 존재
- `StoreEntity`에서 이 컬럼들이 `nullable: false`로 정의되어 있어 스키마 동기화 시 제약 조건 추가 실패

#### 2.2 해결 전략 수립

**단계별 접근:**

1. **임시 조치**: `synchronize: false`로 설정하여 스키마 동기화 비활성화
2. **데이터 정리 스크립트 작성**: `fix-open-date-nulls.sql` 생성
   - 필수 컬럼(`sector`, `openDate`, `location`) 중 하나라도 `null`인 레코드 삭제
3. **지오코딩 작업**: `geocode_script.py`로 `address`가 있는 레코드의 `location` 컬럼 채우기
4. **최종 활성화**: 데이터 정리 완료 후 `synchronize: true`로 변경

**스크립트 위치:**

- `analytic_backend/scripts/fix-open-date-nulls.sql`

**database.config.ts 설정:**

```typescript
// synchronize 설정 전략:
// 1. 현재 false: 백엔드 설계 안정화 단계 (스키마 동기화 비활성화)
// 2. geocode_script.py 실행: address가 있는 모든 레코드의 location 컬럼을 채움
// 3. SQL 스크립트 실행: 필수 컬럼(sector, openDate, location)이 null인 레코드 삭제
// 4. true로 변경: 데이터 정리 완료 후 스키마 동기화 활성화
synchronize: false, // 지오코딩 및 데이터 정리 완료 후 true로 변경
```

### 3. 지오코딩 스크립트 수정

#### 3.1 geocode_script.py 업데이트

**변경 사항:**

- `location_wkt` 컬럼 업데이트 제거 (이미 삭제된 컬럼)
- `location` 컬럼만 PostGIS geometry 형식으로 업데이트

**작동 방식:**

- `address`가 있고 `location`이 `null`인 레코드를 조회
- 카카오 API로 주소를 위경도로 변환
- PostGIS `ST_SetSRID(ST_GeomFromText(:wkt), 4326)` 함수로 `location` 컬럼 업데이트

**일일 할당량:**

- 100,000건 처리 제한 (카카오 API 무료 할당량)

### 4. API 검증 문제 해결

#### 4.1 SurvivalRequestDto ValidationPipe 오류

**문제:**

- `/analysis/survival?sector=C10` API 호출 시 400 에러 발생
- 에러 메시지: `"property sector should not exist"`

**원인:**

- `main.ts`의 `ValidationPipe` 설정에서 `forbidNonWhitelisted: true` 활성화
- `SurvivalRequestDto`에 `@ApiProperty`만 있고 `class-validator` 데코레이터가 없어 ValidationPipe가 속성을 거부

**해결:**

- `SurvivalRequestDto`에 `class-validator` 데코레이터 추가:
  ```typescript
  @IsOptional() // 선택값임을 명시
  @IsString() // 문자열 타입 검증
  sector?: string;
  ```
- ESLint 오류 해결을 위해 해당 라인에 예외 주석 추가

**결과:**

- API 정상 작동
- ValidationPipe가 `sector` 속성을 허용

### 5. 개발 워크플로우 정리

**현재 단계:**

1. ✅ 백엔드 설계 안정화 (`synchronize: false`)
2. ⏳ 지오코딩 작업 (`geocode_script.py` 실행 예정)
3. ⏳ 데이터 정리 (`fix-open-date-nulls.sql` 실행 예정)
4. ⏳ 스키마 동기화 활성화 (`synchronize: true`)

**다음 단계:**

- `geocode_script.py` 실행하여 `address`가 있는 레코드의 `location` 컬럼 채우기
- SQL 스크립트 실행하여 필수 컬럼이 `null`인 레코드 삭제
- 데이터 정리 완료 후 `synchronize: true`로 변경하여 스키마 동기화 활성화

### 6. StoreModule 기능 확장

#### 6.1 StoreService 메서드 추가

**추가된 메서드:**

- `findAllBySector(sector: string)`: 특정 업종의 모든 점포 조회
- `findClosedStores(sector?: string)`: 폐업한 점포 목록 조회 (업종 필터링 지원)

**구현 내용:**

- `findClosedStores`: TypeORM의 `Not(IsNull())` 조건을 사용하여 `closeDate`가 NULL이 아닌 레코드만 조회
- 업종 필터링 지원으로 특정 업종의 폐업 점포만 조회 가능

#### 6.2 StoreController 엔드포인트 추가

**추가된 엔드포인트:**

- `GET /stores/closed`: 폐업한 점포 목록 조회
  - 쿼리 파라미터: `sector` (선택값)
  - 사용 예시: `GET /stores/closed?sector=C10`

**기존 엔드포인트 개선:**

- `GET /stores`: 페이징 파라미터(`page`, `limit`) 추가, `ParseIntPipe`와 `DefaultValuePipe` 사용
- 업종 필터링 지원: `GET /stores?sector=C10`

### 7. AnalysisModule 핵심 기능 구현

#### 7.1 AnalysisService 비즈니스 로직 구현

**구현된 메서드:**

1. **`calculateSurvival(sector?: string)`**: 평균 생존 기간 계산

   - 폐업한 점포들의 개업일과 폐업일을 비교하여 생존 일수 계산
   - 업종별로 그룹화하여 평균 생존 일수 산출
   - 반환값: `{ sector: string, avgDurationDays: number, sampleSize: number }[]`

2. **`getCompetition(lat, lng, radiusMeters, sector)`**: 경쟁 강도 계산
   - 특정 위치와 반경 내 동일 업종 점포 개수 계산
   - `SpatialService.countStoresInRadius`를 사용하여 PostGIS 레벨에서 고성능 처리
   - 반환값: `{ totalCount: number, sector: string }`

#### 7.2 AnalysisController API 엔드포인트

**구현된 엔드포인트:**

1. **`GET /analysis/stores/openings`**: 점포 개업 현황 스냅샷

   - 최근 개업한 점포들의 통계 정보 제공
   - Redis 캐시 적용 (TTL: 300초)
   - 반환값: `{ sampleSize, latestOpenedAt, sectors }`

2. **`GET /analysis/survival`**: 평균 생존 기간 분석

   - 쿼리 파라미터: `sector` (선택값)
   - Redis 캐시 적용 (TTL: 3600초 = 1시간)
   - 반환값: 업종별 평균 생존 일수 배열

3. **`GET /analysis/competition`**: 경쟁 강도 공간 분석
   - 쿼리 파라미터: `lat`, `lon`, `radiusMeters`, `sector` (모두 필수)
   - `ParseFloatPipe`로 좌표 및 반경 값 자동 변환 및 검증
   - 좌표 범위 검증: 위도(-90~90), 경도(-180~180), 반경(1~10000m)
   - 캐싱 미적용 (실시간 좌표 기반 쿼리)

### 8. DTO 및 검증 시스템 구축

#### 8.1 Analysis DTO 작성

**파일:** `shared/dto/analysis.dto.ts`

**구현된 DTO:**

- `SurvivalRequestDto`: 생존 기간 분석 요청 (sector?: string)
- `SurvivalResponseDto`: 생존 기간 분석 응답 (sector, avgDurationDays, sampleSize)
- `CompetitionRequestDto`: 경쟁 강도 분석 요청 (lat, lon, radiusMeters, sector)
- `CompetitionResponseDto`: 경쟁 강도 분석 응답 (totalCount, sector)

**특징:**

- `@ApiProperty` 데코레이터로 Swagger 문서화
- `class-validator` 데코레이터(`@IsOptional`, `@IsString`)로 ValidationPipe 통합

#### 8.2 공통 DTO 작성

**파일:** `shared/dto/error-response.dto.ts`

- 표준 에러 응답 형식 정의
- `statusCode`, `message`, `timestamp`, `path` 필드 포함

**파일:** `shared/dto/pagination.dto.ts`

- 페이징 쿼리 파라미터 타입 정의
- `ParseIntPipe`와 `DefaultValuePipe`를 컨트롤러에서 직접 사용하는 방식으로 변경

### 9. 에러 처리 및 검증 강화

#### 9.1 전역 예외 필터 구현

**파일:** `shared/filters/http-exception.filter.ts`

**기능:**

- 모든 HTTP 예외를 캐치하여 표준화된 JSON 응답 형식으로 변환
- `ErrorResponseDto` 형식으로 일관된 에러 응답 제공
- 개발 환경에서 상세한 에러 로그 출력

#### 9.2 커스텀 검증 파이프

**파일:** `shared/pipes/competition-validation.pipe.ts`

**기능:**

- 경쟁 강도 분석 요청의 좌표 및 반경 값 검증
- 위도(-90~90), 경도(-180~180), 반경(1~10000m) 범위 검증
- 업종 코드 필수값 검증

#### 9.3 main.ts 전역 설정

**추가된 설정:**

- `ValidationPipe` 전역 적용
  - `transform: true`: 쿼리 파라미터를 DTO로 자동 변환
  - `whitelist: true`: DTO에 정의되지 않은 속성 제거
  - `forbidNonWhitelisted: true`: 정의되지 않은 속성이 있으면 에러 반환
- `HttpExceptionFilter` 전역 적용
- `LoggingInterceptor` 전역 적용

### 10. Swagger API 문서화

#### 10.1 Swagger 설정

**main.ts에 추가:**

- `DocumentBuilder`로 API 문서 메타데이터 설정
- `SwaggerModule.setup('api', app, document)`로 `/api` 경로에 Swagger UI 배치

**태그 설정:**

- `stores`: 점포 데이터 조회
- `analysis`: 상권 분석 지표
- `spatial`: 공간 분석
- `test`: 시스템 테스트

#### 10.2 컨트롤러 문서화

**적용된 데코레이터:**

- `@ApiTags`: 컨트롤러 그룹화
- `@ApiOperation`: API 설명 및 요약
- `@ApiQuery`: 쿼리 파라미터 설명
- `@ApiResponse`: 응답 형식 및 예시 정의

**문서화된 엔드포인트:**

- `/analysis/stores/openings`
- `/analysis/survival`
- `/analysis/competition`
- `/stores`
- `/stores/closed`

### 11. 코드 주석 및 문서화

**추가된 주석:**

- 모든 새로 작성한 클래스, 메서드, 속성에 JSDoc 스타일 주석 추가
- 기능 설명, 파라미터 설명, 반환값 설명, 사용 예시 포함
- 비즈니스 로직의 의도와 동작 방식을 명확히 설명

**주석이 추가된 파일:**

- `store.entity.ts`
- `store.service.ts`
- `store.controller.ts`
- `analysis.service.ts`
- `analysis.controller.ts`
- `spatial.service.ts`
- `spatial.controller.ts`
- 모든 DTO 파일
- 필터 및 파이프 파일
