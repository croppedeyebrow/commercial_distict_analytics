# Python 데이터 분석 방향성

## 개요

상권 분석 플랫폼의 복잡한 통계 계산을 Python의 데이터 분석 라이브러리(pandas, numpy 등)를 활용하여 사전에 계산하고, 그 결과를 PostgreSQL 테이블에 저장하는 방식으로 전환합니다. Nest.js 백엔드는 사전 계산된 결과를 조회하여 서빙하는 역할만 수행합니다.

## 아키텍처 개요

```
┌─────────────────────────────────┐
│  Python 데이터 분석 스크립트      │
│  (배치 작업)                      │
│  - pandas, numpy 활용            │
│  - 복잡한 통계 계산 수행          │
└────────────┬────────────────────┘
             │
             │ INSERT/UPDATE
             ▼
┌─────────────────────────────────┐
│  PostgreSQL                     │
│  - store (원본 데이터)           │
│  - survival_analysis            │  ← 사전 계산된 분석 결과
│  - store_opening_snapshot       │  ← 사전 계산된 스냅샷
└────────────┬────────────────────┘
             │
             │ SELECT (단순 조회)
             ▼
┌─────────────────────────────────┐
│  Nest.js API                    │
│  - 빠른 응답 (10-50ms)          │
│  - 단순 조회 로직만 수행         │
└─────────────────────────────────┘
```

## 분석 대상 및 전략

### 1. 생존 기간 분석 (Survival Analysis)

#### 목적

폐업한 점포들의 개업일과 폐업일을 비교하여 업종별 평균 생존 일수를 계산합니다.

#### Python 스크립트: `survival_analysis.py`

**위치**: `python_data_processing/survival_analysis.py`

**주요 기능**:

- PostgreSQL에서 폐업 점포 데이터 조회
- pandas를 활용한 업종별 그룹화 및 평균 계산
- `survival_analysis` 테이블에 결과 저장 (UPSERT)

**구현 로직**:

1. **필수 라이브러리 import**

   - `pandas`: 데이터 분석 및 처리
   - `sqlalchemy`: PostgreSQL 연결 및 쿼리 실행
   - `datetime`: 시간 정보 처리
   - `os`, `dotenv`: 환경 변수 로드

2. **데이터베이스 연결**

   - 환경 변수에서 PostgreSQL 연결 정보 로드
   - `create_engine()`을 사용하여 DB 연결 생성

3. **폐업 점포 데이터 조회**

   - `close_date`, `open_date`, `sector`가 모두 NOT NULL인 레코드 조회
   - 쿼리문은 개발 시 구현

4. **데이터 처리**

   - pandas DataFrame으로 데이터 로드
   - 생존 일수 계산: `(close_date - open_date).dt.days`
   - 음수 값 제거 (데이터 오류 방지)
   - 업종별 그룹화 및 평균 계산: `groupby('sector').agg()`

5. **결과 저장**

   - UPSERT 방식으로 `survival_analysis` 테이블에 저장
   - `sector`가 이미 존재하면 업데이트, 없으면 삽입
   - 쿼리문은 개발 시 구현

6. **실행**
   - `if __name__ == '__main__'` 블록에서 함수 호출

#### 실행 방법

- `python_data_processing` 디렉토리로 이동
- `python survival_analysis.py` 명령어로 스크립트 실행

#### 배치 작업 스케줄링

**옵션 1: cron (Linux/Mac)**

- cron 표현식을 사용하여 주기적 실행 설정
- 예: 매일 새벽 2시에 실행하도록 설정
- 구체적인 cron 설정은 개발 시 구현

**옵션 2: Windows Task Scheduler**

- 작업 스케줄러에서 Python 스크립트를 주기적으로 실행하도록 설정

**옵션 3: Airflow (향후 확장)**

- 복잡한 데이터 파이프라인이 필요한 경우 Apache Airflow 도입 고려

**옵션 2: Windows Task Scheduler**

- 작업 스케줄러에서 Python 스크립트를 주기적으로 실행하도록 설정

**옵션 3: Airflow (향후 확장)**

- 복잡한 데이터 파이프라인이 필요한 경우 Apache Airflow 도입 고려

### 2. 점포 개업 현황 스냅샷 (Store Opening Snapshot)

#### 목적

최근 개업한 점포들의 기본 통계를 일별/주별로 집계하여 저장합니다.

#### Python 스크립트: `store_opening_snapshot.py`

**위치**: `python_data_processing/store_opening_snapshot.py`

**주요 기능**:

- 최근 개업 점포 데이터 조회
- 일별/주별 집계
- `store_opening_snapshot` 테이블에 결과 저장

**구현 로직**:

1. **필수 라이브러리 import**

   - `pandas`: 데이터 분석 및 처리
   - `sqlalchemy`: PostgreSQL 연결 및 쿼리 실행
   - `datetime`, `timedelta`: 시간 정보 처리
   - `os`, `dotenv`: 환경 변수 로드

2. **데이터베이스 연결**

   - 환경 변수에서 PostgreSQL 연결 정보 로드
   - `create_engine()`을 사용하여 DB 연결 생성

3. **최근 개업 점포 데이터 조회**

   - `open_date`가 NOT NULL인 레코드 조회
   - `open_date DESC` 정렬 및 `LIMIT` 적용
   - 쿼리문은 개발 시 구현

4. **통계 계산**

   - `sample_size`: 조회된 점포 개수
   - `latest_opened_at`: 최신 개업일
   - `sectors`: 업종 목록 (중복 제거)

5. **스냅샷 저장**

   - `snapshot_date`: 현재 날짜
   - `store_opening_snapshot` 테이블에 INSERT
   - 쿼리문은 개발 시 구현

6. **실행**
   - `if __name__ == '__main__'` 블록에서 함수 호출

### 3. 향후 확장 가능한 분석 항목

#### 3.1 업종별 점포 증감율 분석

- 월별/연도별 업종별 점포 개수 변화 추이
- pandas의 `groupby`와 `pct_change()` 활용

#### 3.2 지역별(행정구역) 점포 밀도 분석

- 시/구/동 단위로 점포 밀도 계산
- PostGIS의 `ST_Within`을 활용한 공간 집계

#### 3.3 시계열 분석 (Time Series Analysis)

- 점포 개업/폐업 추이를 시계열로 분석
- pandas의 `resample()` 활용

## 데이터베이스 스키마

### `survival_analysis` 테이블

**테이블 구조**:

- `sector` (VARCHAR(10), PRIMARY KEY): 업종 코드
- `avg_duration_days` (DECIMAL(10, 2), NOT NULL): 평균 생존 일수
- `sample_size` (INTEGER, NOT NULL): 샘플 크기
- `calculated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP): 계산 시각
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP): 업데이트 시각
- 인덱스: `sector` 컬럼에 인덱스 생성

**스키마 생성**: 개발 시 SQL 스크립트로 테이블 생성

### `store_opening_snapshot` 테이블

**테이블 구조**:

- `id` (SERIAL, PRIMARY KEY): 고유 식별자
- `snapshot_date` (DATE, NOT NULL): 스냅샷 날짜
- `sample_size` (INTEGER, NOT NULL): 샘플 크기
- `latest_opened_at` (DATE, NOT NULL): 최신 개업일
- `sectors` (TEXT[], NOT NULL): 업종 목록 배열
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP): 생성 시각
- 인덱스: `snapshot_date` 컬럼에 인덱스 생성

**스키마 생성**: 개발 시 SQL 스크립트로 테이블 생성

## Python 환경 설정

### 필수 패키지

- `pandas` (>=2.0.0): 데이터 분석 및 처리
- `numpy` (>=1.24.0): 수치 계산
- `sqlalchemy` (>=2.0.0): PostgreSQL 연결 및 쿼리 실행
- `psycopg2-binary` (>=2.9.0): PostgreSQL 드라이버
- `python-dotenv` (>=1.0.0): 환경 변수 로드

**requirements.txt 파일 생성**: 개발 시 위 패키지들을 포함한 requirements.txt 파일 작성

### 설치 방법

- `python_data_processing` 디렉토리로 이동
- `pip install -r requirements.txt` 명령어로 패키지 설치

## 성능 및 최적화

### 1. 대용량 데이터 처리

- **청크 처리**: 대용량 데이터는 `pd.read_sql()`의 `chunksize` 파라미터 활용
- **인덱스 활용**: PostgreSQL 인덱스를 최적화하여 조회 속도 향상

### 2. 메모리 관리

- 불필요한 컬럼은 조회 시 제외
- 계산 완료 후 데이터프레임 메모리 해제

### 3. 에러 처리

- 데이터 오류(음수 생존 일수 등) 필터링
- DB 연결 실패 시 재시도 로직 구현

## 모니터링 및 로깅

### 로깅 설정

- Python `logging` 모듈 사용
- 로그 레벨: `INFO`
- 로그 포맷: 타임스탬프, 로거 이름, 레벨, 메시지 포함
- 핸들러: 파일 핸들러(`survival_analysis.log`) 및 콘솔 핸들러
- 구체적인 코드는 개발 시 구현

### 실행 결과 모니터링

- 분석 완료 시 로그 파일에 결과 기록
- 에러 발생 시 알림 시스템 연동 (선택사항)

## 개발 워크플로우

1. **로컬 개발**: Python 스크립트를 직접 실행하여 결과 확인
2. **테스트**: 소량 데이터로 정확성 검증
3. **프로덕션 배포**: 배치 작업 스케줄러에 등록
4. **모니터링**: 로그 및 DB 데이터 확인

## 주의사항

- **데이터 동기화**: Python 배치 작업이 실행되기 전까지는 이전 분석 결과가 조회됩니다.
- **배치 작업 주기**: 데이터 업데이트 빈도에 맞춰 적절한 주기 설정 필요
- **에러 복구**: 배치 작업 실패 시 수동 재실행 또는 자동 재시도 로직 구현
