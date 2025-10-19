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

//커밋 정료 잘 확인하자.

#### 1.3 핵심 지표 쿼리 작성(SQL 확정)
