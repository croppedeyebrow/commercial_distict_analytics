# 하이브리드 아키텍처 개발 계획

## 개발 목표

Python으로 복잡한 분석을 사전 계산하고, Nest.js는 사전 계산된 결과를 조회하여 서빙하는 하이브리드 아키텍처로 전환합니다.

## 개발 순서

### 📋 Phase 1: 데이터베이스 스키마 준비

#### 1.1 `survival_analysis` 테이블 생성

**작업 내용:**

- SQL 스크립트 작성: `analytic_backend/scripts/create-survival-analysis-table.sql`
- 테이블 구조:
  - `sector` (VARCHAR(10), PRIMARY KEY): 업종 코드
  - `avg_duration_days` (DECIMAL(10, 2), NOT NULL): 평균 생존 일수
  - `sample_size` (INTEGER, NOT NULL): 샘플 크기
  - `calculated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP): 계산 시각
  - `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP): 업데이트 시각
  - 인덱스: `sector` 컬럼에 인덱스 생성

**검증 기준:**

- SQL 스크립트 실행 성공
- 테이블 생성 확인
- 인덱스 생성 확인

**예상 소요 시간:** 30분

---

### 🐍 Phase 2: Python 분석 스크립트 개발

#### 2.1 Python 환경 설정

**작업 내용:**

- `python_data_processing/requirements.txt` 파일 생성
- 필수 패키지 설치:
  - pandas (>=2.0.0)
  - numpy (>=1.24.0)
  - sqlalchemy (>=2.0.0)
  - psycopg2-binary (>=2.9.0)
  - python-dotenv (>=1.0.0)

**검증 기준:**

- `pip install -r requirements.txt` 성공
- 모든 패키지 정상 설치 확인

**예상 소요 시간:** 15분

#### 2.2 `survival_analysis.py` 스크립트 작성

**작업 내용:**

- 파일 위치: `python_data_processing/survival_analysis.py`
- 주요 기능:
  1. PostgreSQL 연결 (환경 변수에서 DB 정보 로드)
  2. 폐업 점포 데이터 조회 (close_date, open_date, sector가 모두 NOT NULL)
  3. pandas를 활용한 생존 일수 계산
  4. 업종별 그룹화 및 평균 계산
  5. `survival_analysis` 테이블에 UPSERT

**구현 세부사항:**

- 생존 일수 계산: `(close_date - open_date).dt.days`
- 음수 값 필터링 (데이터 오류 방지)
- 업종별 평균 계산: `groupby('sector').agg({'duration_days': ['mean', 'count']})`
- 소수점 2자리 반올림
- UPSERT 쿼리: `INSERT ... ON CONFLICT DO UPDATE`

**검증 기준:**

- 스크립트 실행 성공
- `survival_analysis` 테이블에 데이터 저장 확인
- 계산 결과 정확성 검증 (기존 Nest.js 결과와 비교)

**예상 소요 시간:** 2시간

#### 2.3 로깅 및 에러 처리 추가

**작업 내용:**

- Python logging 모듈 설정
- 파일 핸들러 및 콘솔 핸들러 구성
- 예외 처리 로직 추가
- DB 연결 실패 시 재시도 로직

**검증 기준:**

- 로그 파일 생성 확인
- 에러 발생 시 적절한 로그 기록 확인

**예상 소요 시간:** 30분

---

### 🏗️ Phase 3: Nest.js 엔티티 및 서비스 수정

#### 3.1 `SurvivalAnalysisEntity` 생성

**작업 내용:**

- 파일 위치: `analytic_backend/src/modules/analysis/entities/survival-analysis.entity.ts`
- TypeORM 엔티티 클래스 정의
- 필드 매핑:
  - `sector`: PrimaryColumn (varchar, length: 10)
  - `avgDurationDays`: Column (decimal, precision: 10, scale: 2)
  - `sampleSize`: Column (int)
  - `calculatedAt`: CreateDateColumn
  - `updatedAt`: UpdateDateColumn

**검증 기준:**

- 엔티티 클래스 컴파일 성공
- TypeORM이 엔티티 인식 확인

**예상 소요 시간:** 30분

#### 3.2 `AnalysisModule`에 엔티티 등록

**작업 내용:**

- `AnalysisModule`에 `TypeOrmModule.forFeature([SurvivalAnalysisEntity])` 추가
- 필요 시 `AnalysisResultService` 생성 (선택사항)

**검증 기준:**

- 모듈 로드 성공
- 엔티티 주입 가능 확인

**예상 소요 시간:** 15분

#### 3.3 `AnalysisService.calculateSurvival` 메서드 수정

**작업 내용:**

- 기존 메모리 계산 로직 제거
- `DataSource.query()`를 사용하여 `survival_analysis` 테이블 조회
- `sector` 파라미터에 따라 필터링 또는 전체 조회
- 반환값 형식 유지 (기존 API 호환성)

**구현 세부사항:**

- `sector`가 있으면: `WHERE sector = $1` 조건 추가
- `sector`가 없으면: 전체 업종 조회, `ORDER BY sector`
- 결과를 `SurvivalResponseDto[]` 형식으로 변환

**검증 기준:**

- 메서드 컴파일 성공
- 쿼리 실행 성공
- 반환값 형식 정확성 확인

**예상 소요 시간:** 1시간

#### 3.4 에러 처리 및 Fallback 로직 구현

**작업 내용:**

- `survival_analysis` 테이블에 데이터가 없는 경우 처리
- 옵션 1: 빈 배열 반환
- 옵션 2: 기존 계산 로직으로 fallback (선택사항)
- 적절한 에러 메시지 반환

**검증 기준:**

- 데이터가 없을 때 적절한 응답 확인
- 에러 발생 시 적절한 처리 확인

**예상 소요 시간:** 30분

---

### 🧪 Phase 4: 테스트 및 검증

#### 4.1 단위 테스트

**작업 내용:**

- `AnalysisService.calculateSurvival` 메서드 단위 테스트 작성
- Mock 데이터를 사용한 테스트
- Edge case 테스트 (데이터 없음, 특정 업종만 존재 등)

**검증 기준:**

- 모든 테스트 케이스 통과
- 테스트 커버리지 확인

**예상 소요 시간:** 1시간

#### 4.2 통합 테스트

**작업 내용:**

- Python 스크립트 실행 → Nest.js API 호출 → 결과 검증
- 기존 API 응답과 비교하여 정확성 검증
- 응답 시간 측정 (목표: 10-50ms)

**검증 기준:**

- API 응답 정확성 확인
- 응답 시간 목표 달성
- 데이터 일관성 확인

**예상 소요 시간:** 1시간

#### 4.3 성능 테스트

**작업 내용:**

- 기존 방식 vs 새 방식 응답 시간 비교
- 동시 요청 처리 성능 테스트
- DB 부하 모니터링

**검증 기준:**

- 응답 시간 80-90% 개선 확인
- DB 부하 감소 확인

**예상 소요 시간:** 30분

---

### ⚙️ Phase 5: 캐싱 전략 조정

#### 5.1 Redis 캐시 설정 변경

**작업 내용:**

- `GET /analysis/survival` 엔드포인트의 캐시 전략 검토
- 옵션 1: 캐시 제거 (사전 계산 결과 조회가 이미 빠름)
- 옵션 2: TTL 단축 (예: 300초 → 60초)
- `@UseInterceptors(CacheInterceptor)` 제거 또는 TTL 조정

**검증 기준:**

- 캐시 설정 변경 확인
- API 응답 시간 영향 확인

**예상 소요 시간:** 15분

---

### 📅 Phase 6: 배치 작업 스케줄링

#### 6.1 배치 작업 스케줄러 설정

**작업 내용:**

- 운영 환경에 맞는 스케줄러 선택:
  - **개발 환경**: 수동 실행 또는 간단한 cron
  - **프로덕션 환경**: cron, Windows Task Scheduler, 또는 Airflow
- 실행 주기 결정 (예: 매일 새벽 2시)
- 실행 스크립트 작성 (선택사항)

**검증 기준:**

- 스케줄러 설정 완료
- 테스트 실행 성공

**예상 소요 시간:** 30분

#### 6.2 모니터링 설정

**작업 내용:**

- 배치 작업 실행 로그 모니터링
- 실패 시 알림 설정 (선택사항)
- 실행 결과 확인 프로세스 수립

**검증 기준:**

- 모니터링 시스템 구축 완료
- 알림 테스트 성공

**예상 소요 시간:** 30분

---

## 전체 일정 요약

| Phase    | 작업 내용                     | 예상 소요 시간    |
| :------- | :---------------------------- | :---------------- |
| Phase 1  | 데이터베이스 스키마 생성      | 30분              |
| Phase 2  | Python 분석 스크립트 개발     | 3시간             |
| Phase 3  | Nest.js 엔티티 및 서비스 수정 | 2시간 15분        |
| Phase 4  | 테스트 및 검증                | 2시간 30분        |
| Phase 5  | 캐싱 전략 조정                | 15분              |
| Phase 6  | 배치 작업 스케줄링            | 1시간             |
| **총계** |                               | **약 9시간 30분** |

## 주의사항

1. **데이터 동기화**: Python 배치 작업이 실행되기 전까지는 이전 분석 결과가 조회됩니다. 초기 실행은 수동으로 진행하세요.

2. **에러 처리**: `survival_analysis` 테이블에 데이터가 없는 경우를 대비한 fallback 로직이 필수입니다.

3. **기존 API 호환성**: 기존 API 응답 형식을 유지하여 클라이언트 코드 변경을 최소화합니다.

4. **경쟁 강도 분석**: `/analysis/competition` 엔드포인트는 변경하지 않습니다. (동적 파라미터로 사전 계산 불가)

5. **테스트 데이터**: 개발 단계에서는 소량의 테스트 데이터로 정확성을 검증한 후, 전체 데이터로 확장합니다.

## 다음 단계

Phase 1부터 순차적으로 진행하며, 각 Phase 완료 후 검증을 수행합니다.

**시작:** Phase 1 - 데이터베이스 스키마 생성부터 시작하시겠습니까?
