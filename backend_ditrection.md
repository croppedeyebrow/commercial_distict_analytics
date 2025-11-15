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
