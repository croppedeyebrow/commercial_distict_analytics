# Custom repositories

이 디렉터리는 TypeORM 기본 Repository 로는 표현하기 어려운
고급 쿼리와 데이터 접근 패턴을 구현할 때 사용합니다.

- `StoreRepository` : 복잡한 필터 조건, 지오스페이셜 정렬
- `AnalysisRepository` : 통계성 쿼리

필요 시 `DataSource.getRepository()` 대신 커스텀 클래스를 주입하도록 설계합니다.
