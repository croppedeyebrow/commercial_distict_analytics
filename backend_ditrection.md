# 백엔드 구조 기획 (analytic_backend 기준)

```
/district_analytics
└── /analytic_backend (Nest.js API 서버)
    ├── package.json / tsconfig*.json / .env
    └── /src
        ├── main.ts / app.module.ts
        ├── /config          # 인프라 설정 (DB, Redis, Env)
        ├── /modules         # 도메인 모듈 (analysis, store, spatial 등)
        ├── /shared          # 공통 DTO, 인터셉터, 유틸
        └── /infra           # Repository, 외부 연동
```

---

## 1. Config Layer (`/src/config`)

| 파일                 | 역할                                            |
| -------------------- | ----------------------------------------------- |
| `config.module.ts`   | `ConfigModule.forRoot`, ENV validation          |
| `database.config.ts` | TypeORM + PostgreSQL/PostGIS 연결 설정          |
| `redis.config.ts`    | `CacheModule.registerAsync` + `redisStore` 옵션 |
| `app.config.ts`      | 글로벌 설정 (포트, 로깅, CORS)                  |

> `app.module.ts`에서는 Config/DB/Cache 모듈만 import하고, 실제 비즈니스 모듈은 `/modules/*`에서 관리한다.

---

## 2. Domain Modules (`/src/modules`)

### 2.1 StoreModule (점포 데이터)

- `store.entity.ts`: 위치(`geometry`), 업종, 영업/폐업일 등
- `store.service.ts`: CRUD + 필터 + pagination
- `store.controller.ts`: `/stores` REST API
- 향후 ETL 결과를 바로 반영 (batch insert 대비)

### 2.2 AnalysisModule (지표/통계)

- Store 데이터를 활용한 KPI/지표 계산 (점포 증감율, 업종 분포 등)
- 복잡 계산에 Redis 캐시 적용 (TTL=5분, `cache-manager-redis-yet`)
- `/analysis` 컨트롤러에서 결과 제공

### 2.3 SpatialModule (PostGIS 연산)

- PostGIS Raw Query 실행 (반경 검색, KNN 등)
- `spatial.service.ts`에서 `DataSource`/`QueryRunner` 이용
- 타 모듈에서 재사용 가능한 공간 유틸 제공

---

## 3. Shared & Infra

- `/shared/dto`: 페이징, 표준 응답, 공통 요청 DTO
- `/shared/interceptors`: 로깅, 캐시, 에러 처리
- `/shared/utils`: 좌표 변환, 문자열 정규화 등
- `/infra/repositories`: TypeORM 커스텀 repo, 외부 API 연동

---

## 4. Redis 캐시 전략

- `CacheModule` 전역 설정 (`isGlobal: true`, `redisStore`)
- 분석/지표 API는 수동 캐싱 (`CACHE_MANAGER`) 또는 `@UseInterceptors(CacheInterceptor)`
- `/test/redis-test`: Redis 연결 상태 점검
- `/test/cache`: 캐시 TTL 테스트 (300,000ms = 5분)

---

## 5. 개발 플로우 제안

1. **Config 확립**: env → ConfigModule → TypeORM/Redis 설정
2. **StoreModule 구축**: 엔티티/서비스/컨트롤러 + 기본 CRUD
3. **SpatialModule**: PostGIS 기능 헬퍼화
4. **AnalysisModule**: Redis 캐싱 적용한 지표 API
5. **Shared/Infra 보강**: DTO, 인터셉터, Repository 정리

> 이 흐름으로 진행하면 데이터 파이프라인(ETL 결과)과 Nest 백엔드가 자연스럽게 맞물리고, Redis로 응답 지연도 줄일 수 있다.

---

# 🚀 상권 분석 플랫폼 (MVP) 백엔드 설계 기획서 (FSD)

## 1\. 🎯 프로젝트 개요 및 아키텍처 원칙

### 1.1. 시스템 및 목표 정의

| 구분               | 내용                                                               |
| :----------------- | :----------------------------------------------------------------- |
| **시스템 명**      | Analytic Backend (상권 분석 API 서버)                              |
| **핵심 목적**      | PostGIS 기반의 고성능 공간 분석 및 시계열 분석 API 제공            |
| **기술 스택**      | Nest.js (TypeScript), PostgreSQL/PostGIS, Docker (Redis, DB)       |
| **핵심 성능 목표** | **경쟁 강도 분석** 응답 시간: **100ms 이내** (DB GIST 인덱스 활용) |
| **아키텍처 원칙**  | **Domain-Driven Design (DDD)** 및 **Clean Architecture** 원칙 적용 |

### 1.2. 폴더 구조 상세 명세

모든 코드는 `/analytic_backend/src` 내부에 위치하며, 역할별로 엄격히 분리됩니다.

```
/src
├── /main.ts / /app.module.ts
├── /config                 # TypeORM, Redis 등 인프라 설정 템플릿
│   └── /database.config.ts
├── /modules                # 🚨 도메인별 코드 (Domain Modules)
│   ├── /analysis           # (Core Logic) 생존 기간, 경쟁 강도 계산
│   ├── /store              # (Data Access) Store Entity 관리 및 기본 조회
│   └── /spatial            # (Infrastructure) PostGIS Raw Query 추상화
├── /shared                 # 공통 DTO, 인터셉터, 유틸리티
│   └── /dto                # (e.g., /shared/dto/pagination.dto.ts)
└── /infra                  # (Custom Repo, Third-Party Adaptors)
    └── /repositories       # (e.g., /infra/repositories/store.repository.ts)
```

---

## 2\. 🗃️ 데이터 모델 및 인덱스 상세 스펙

### 2.1. `Store` 엔티티 (DB 테이블: `store`)

| 필드명         | Nest.js 타입 | SQL 타입                    | 제약조건         | 설명                                  |
| :------------- | :----------- | :-------------------------- | :--------------- | :------------------------------------ |
| `id`           | `number`     | `INT`                       | **PK**, NOT NULL | 점포 고유 식별자                      |
| `store_name`   | `string`     | `VARCHAR(255)`              | NULLABLE         | 점포명 (분석 외 목적)                 |
| `sector`       | `string`     | `VARCHAR(50)`               | NOT NULL         | **업종 분류 코드 (e.g., 'C10' 카페)** |
| `open_date`    | `Date`       | `DATE`                      | NOT NULL         | 영업 시작일                           |
| `close_date`   | `Date`       | `DATE`                      | NULLABLE         | 영업 종료일 (NULL: 영업 중)           |
| **`location`** | `string`     | **`GEOMETRY(Point, 4326)`** | NOT NULL         | **PostGIS 공간 데이터 (경도, 위도)**  |

### 2.2. 인덱스 상세 명세 (성능 필수)

| 컬럼                  | 인덱스 타입            | 용도                                                                       | 비고                                   |
| :-------------------- | :--------------------- | :------------------------------------------------------------------------- | :------------------------------------- |
| **`location`**        | **`GIST` (Spatial)**   | 경쟁 강도 (`ST_DWithin`) 쿼리 최적화                                       | **성능 목표 달성을 위한 필수 인덱스.** |
| `sector`              | `B-Tree`               | 업종별 필터링, 그룹화 (생존 기간)                                          | 일반적인 검색 효율 향상.               |
| `close_date`          | `B-Tree`               | 폐업 점포 필터링 (`IS NOT NULL`)                                           | 생존 기간 분석 쿼리 최적화.            |
| `sector` + `location` | **복합 인덱스 (선택)** | `sector`와 공간 검색이 동시에 발생하는 쿼리 최적화 (향후 모니터링 후 적용) |

---

## 3\. 💻 핵심 API 명세 (Analysis Controller)

### 3.1. API 1: 평균 생존 기간 분석 (Survival Analysis)

| 속성             | 상세 스펙                                                                                         |
| :--------------- | :------------------------------------------------------------------------------------------------ |
| **Endpoint**     | `GET /analysis/survival`                                                                          |
| **Presentation** | `AnalysisController.getSurvivalDuration()`                                                        |
| **Request DTO**  | `SurvivalRequestDto` (`/shared/dto/`)                                                             |
| **Query Param**  | `sector` (string, Optional, e.g., 'C10'), `minOpenDate` (Date)                                    |
| **Response DTO** | `SurvivalResponseDto` ( `{ sector: string, avgDurationDays: number }[]` )                         |
| **Cache 전략**   | **TTL: 3600초 (1시간)**. `@UseInterceptors(CacheInterceptor)` 적용.                               |
| **로직 위임**    | `AnalysisService.calculateSurvival(sector)` $\rightarrow$ `StoreService.findClosedStores(sector)` |
| **SQL 핵심**     | `AVG(EXTRACT(DAY FROM close_date - open_date)) WHERE sector = :sector`                            |

### 3.2. API 2: 경쟁 강도 공간 분석 (Competition Analysis)

| 속성             | 상세 스펙                                                                                     |
| :--------------- | :-------------------------------------------------------------------------------------------- |
| **Endpoint**     | `GET /analysis/competition`                                                                   |
| **Presentation** | `AnalysisController.getCompetitionCount()`                                                    |
| **Request DTO**  | `CompetitionRequestDto`                                                                       |
| **Query Param**  | `lat`, `lon` (float), `radiusMeters` (int), `sector` (string, NOT NULL)                       |
| **Response DTO** | `CompetitionResponseDto` ( `{ totalCount: number, sector: string }` )                         |
| **Cache 전략**   | **캐싱 미적용 (TTL 0)**. 실시간 좌표 기반 쿼리.                                               |
| **로직 위임**    | `AnalysisService.getCompetition(dto)` $\rightarrow$ `SpatialService.countStoresInRadius(...)` |
| **SQL 핵심**     | **`ST_DWithin(location::geography, target_point::geography, :radiusMeters)`**                 |

---

## 4\. ⚙️ 모듈별 책임 및 구현 상세

### 4.1. `SpatialModule` 상세 구현 (Raw Query 실행 책임)

- **컴포넌트:** `spatial.service.ts`
- **핵심 역할:** PostGIS 쿼리 상세 구현 담당. (Infrastructure Layer)
- **주요 메서드 명세:**
  - `countStoresInRadius(lon: number, lat: number, radius: number, sector: string)`:
    - 입력된 좌표를 PostGIS의 `$ST\_MakePoint$` 함수로 변환.
    - `ST_DWithin`을 사용한 `SELECT COUNT(*)` 쿼리를 `QueryRunner` 또는 `DataSource`를 통해 직접 실행.
    - **SQL 인젝션 방지:** 모든 파라미터는 반드시 TypeORM의 쿼리 빌더 바인딩을 통해 전달해야 함.

### 4.2. `AnalysisModule` 상세 구현 (비즈니스 로직)

- **컴포넌트:** `analysis.service.ts`
- **핵심 역할:** 복잡한 비즈니스 로직 및 외부 모듈 조합. (Application Layer)
- **구현 상세:**
  - `calculateSurvival` 메서드 내에서 **Date 객체 연산**을 통해 생존 일수를 계산하고, JavaScript/TypeScript 내장 기능으로 평균을 산출함. (DB 부하를 줄이기 위해 최대한 데이터 필터링 후 메모리에서 연산)

### 4.3. `StoreModule` 상세 구현 (TypeORM 표준)

- **컴포넌트:** `store.service.ts`, `store.entity.ts`
- **핵심 역할:** **TypeORM Repository**에 대한 얇은 래퍼(Wrapper) 역할.
- **구현 상세:** `StoreService`는 `Repository<Store>`를 주입받아 사용하며, 공간 연산이 없는 단순한 `Find` 또는 `FindAndCount` 메서드만 제공합니다.

---

## 5\. ⚠️ 기술적 제약 조건 및 리스크 관리

| 제약/리스크         | 내용                                                             | 대응 방안                                                                                                                                                                  |
| :------------------ | :--------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis 연결 실패** | `cache-manager-redis-store`와 Nest.js 버전 충돌 문제 (이미 발생) | **`@nestjs-plus/cache-manager-redis-store`** 또는 **`cache-manager/redis-store`** 등 안정화된 대체 라이브러리로 즉시 전환하여 해결 (V2에서 반영 완료).                     |
| **좌표계 충돌**     | `location` 저장 시 WGS84 (4326) 외 다른 SRID 사용                | DB 및 모든 쿼리에서 **SRID 4326**으로 통일하고, `$ST\_DWithin$` 사용 시 **`::geography` 캐스팅**을 적용하여 정확한 미터 단위 거리 계산 보장.                               |
| **DB 부하**         | `open_date/close_date` 데이터셋이 수백만 건 이상일 때            | `AnalysisModule`의 **Redis TTL을 늘리거나** (예: 24시간), 주기적인 Batch를 통해 분석 결과를 별도 테이블에 미리 계산해두는 **AnalysisResult 테이블 (미래 확장)** 구축 고려. |

---

# 백엔드 기능 정의.

네, 알겠습니다. 개발의 가장 중요한 첫 단계는 **"무엇을 만들 것인가"**를 명확히 하는 것입니다.

지금까지의 논의를 종합하여, **상권 분석 MVP**가 반드시 포함해야 할 **핵심 기능(Feature) 위주의 기획 목록**을 작성해 드립니다. 이 목록을 바탕으로 바로 빌드업을 시작하시면 됩니다.

---

# 📋 상권 분석 MVP: 백엔드 핵심 기능 기획 목록

## 1. 🛡️ 인프라 및 환경 설정 기능 (Foundation)

개발을 시작하기 위한 기반 환경을 설정하는 기능입니다.

| ID        | 기능 명                    | 상세 내용                                                                                                               | 검증 기준                                                              |
| :-------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **F-101** | **DB 연결 및 ORM 초기화**  | PostgreSQL/PostGIS 연결을 환경 변수 기반으로 설정하고 TypeORM을 초기화합니다.                                           | `npm run start:dev` 실행 시 TypeORM 초기화 오류가 없어야 함.           |
| **F-102** | **Redis 캐싱 서비스 연동** | Redis 서버와 Nest.js `CacheModule`을 성공적으로 연결하고 전역 인터셉터 설정.                                            | `GET /test/cache` 호출 시 **2차 호출부터 로직이 건너뛰어지는지** 확인. |
| **F-103** | **공통 유효성 검사**       | 모든 API 요청에 대해 DTO를 사용하여 입력 값(Query Param 등) 유효성 검사 파이프(`ValidationPipe`)를 전역으로 적용합니다. | 잘못된 파라미터 입력 시 400 Bad Request 응답.                          |

---

## 2. 🗃️ 데이터 접근 기능 (Store Domain)

핵심 데이터인 `Store` 엔티티를 다루는 기본 기능입니다.

| ID        | 기능 명                 | 상세 내용                                                                                                            | 담당 모듈      |
| :-------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------- | :------------- |
| **F-201** | **`Store` 엔티티 정의** | `sector`, `open_date`, `close_date`, **`location (GEOMETRY)`** 컬럼을 포함하는 `Store` 엔티티를 정의합니다.          | `StoreModule`  |
| **F-202** | **기본 데이터 조회**    | 특정 `sector`를 기준으로 필터링된 모든 `Store` 데이터를 조회하는 기본 `findAllBySector(sector)` 메서드를 구현합니다. | `StoreService` |
| **F-203** | **폐업 데이터 조회**    | `close_date` 컬럼이 `IS NOT NULL`인 폐업 점포 데이터를 필터링하여 조회합니다. (생존 기간 분석의 기초 데이터)         | `StoreService` |

---

## 3. 🗺️ 공간 유틸리티 기능 (Spatial Domain)

PostGIS를 활용한 고성능 공간 쿼리를 추상화하여 제공하는 유틸리티 기능입니다.

| ID        | 기능 명                  | 상세 내용                                                                                                             | 핵심 기술                             |
| :-------- | :----------------------- | :-------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| **F-301** | **반경 내 점포 수 계산** | 지정된 위도/경도(`lat/lon`)와 반경(`radiusMeters`) 내에 존재하는 **특정 업종(`sector`)의 점포 수**를 계산합니다.      | **PostGIS $ST\_DWithin$** (Raw Query) |
| **F-302** | **공간 쿼리 실행기**     | PostGIS Raw Query를 실행하고 결과를 TypeScript 객체로 변환하여 반환하는 메서드를 `QueryRunner`를 사용하여 구현합니다. | `SpatialService`                      |

---

## 4. 📊 분석 및 API 기능 (Analysis Domain)

MVP의 핵심 비즈니스 지표를 계산하고 사용자에게 제공하는 API 기능입니다.

| ID        | 기능 명                 | 상세 내용                                                                                              | API Endpoint                |
| :-------- | :---------------------- | :----------------------------------------------------------------------------------------------------- | :-------------------------- |
| **F-401** | **평균 생존 기간 API**  | 업종별(`sector`) 폐업 데이터를 기반으로 **평균 생존 일수**를 계산하여 반환합니다.                      | `GET /analysis/survival`    |
| **F-402** | **경쟁 강도 API**       | 요청 좌표(`lat/lon`)와 반경(`radius`)에 대해 **F-301** 기능을 호출하여 동종 업종 점포 수를 반환합니다. | `GET /analysis/competition` |
| **F-403** | **생존 기간 결과 캐싱** | **F-401** API에 `@UseInterceptors(CacheInterceptor)`를 적용하여 Redis를 통한 응답 캐싱을 구현합니다.   | N/A (성능 기능)             |
