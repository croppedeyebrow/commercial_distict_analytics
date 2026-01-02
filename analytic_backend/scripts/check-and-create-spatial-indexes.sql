-- PostGIS 공간 인덱스 확인 및 생성 스크립트
-- Phase 1.2: 공간 쿼리 성능 최적화

-- ============================================
-- 1. 현재 인덱스 상태 확인
-- ============================================

-- location 컬럼에 대한 모든 인덱스 확인
SELECT
    indexname,
    indexdef,
    tablename
FROM
    pg_indexes
WHERE
    tablename = 'store'
    AND indexdef LIKE '%location%'
ORDER BY
    indexname;

-- GIST 인덱스 상세 정보 확인
SELECT
    i.relname AS index_name,
    a.attname AS column_name,
    am.amname AS index_type,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size
FROM
    pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_am am ON i.relam = am.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE
    t.relname = 'store'
    AND a.attname = 'location'
ORDER BY
    i.relname;

-- ============================================
-- 2. GIST 인덱스 생성 (없는 경우)
-- ============================================

-- location 컬럼에 GIST 인덱스가 없으면 생성
-- 기존 인덱스가 있으면 에러가 발생하므로, IF NOT EXISTS는 지원하지 않음
-- 대신 DROP INDEX IF EXISTS 후 CREATE INDEX 사용

DROP INDEX IF EXISTS idx_location_gist;
CREATE INDEX idx_location_gist ON store USING GIST (location);

-- 인덱스 생성 후 통계 정보 업데이트
ANALYZE store;

-- ============================================
-- 3. 복합 인덱스 검토 (선택사항)
-- ============================================

-- sector + location 복합 인덱스 (업종 필터링과 공간 검색이 함께 사용되는 경우)
-- 현재는 단일 인덱스로 충분하지만, 향후 성능 모니터링 후 필요시 생성
-- CREATE INDEX idx_sector_location ON store USING GIST (sector, location);

-- ============================================
-- 4. 인덱스 사용 여부 확인 (EXPLAIN ANALYZE)
-- ============================================

-- 샘플 쿼리로 인덱스 사용 확인
EXPLAIN ANALYZE
SELECT
    id,
    "storeName",
    "sector",
    "address",
    ST_AsGeoJSON(location) AS location
FROM store
WHERE location IS NOT NULL
    AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(126.9826, 37.5636), 4326)::geography,
        500
    )
ORDER BY "openDate" DESC
LIMIT 100;

-- ============================================
-- 5. 인덱스 통계 정보 확인
-- ============================================

-- 인덱스 크기 및 사용 통계
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM
    pg_stat_user_indexes
WHERE
    tablename = 'store'
    AND indexname LIKE '%location%'
ORDER BY
    idx_scan DESC;

-- ============================================
-- 참고: 인덱스 삭제 (필요시)
-- ============================================

-- DROP INDEX IF EXISTS idx_location_gist;

