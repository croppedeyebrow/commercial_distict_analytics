-- 폐업 데이터 상태 확인 스크립트
-- 이 스크립트로 폐업 데이터가 실제로 있는지, 그리고 location이 NULL인 폐업 데이터가 있는지 확인합니다.

-- 1. 전체 점포 수 및 폐업 점포 수 확인
SELECT 
    COUNT(*) as total_stores,
    COUNT(*) FILTER (WHERE "closeDate" IS NOT NULL) as closed_stores,
    COUNT(*) FILTER (WHERE "closeDate" IS NULL) as open_stores,
    COUNT(*) FILTER (WHERE "closeDate" IS NOT NULL AND "location" IS NULL) as closed_stores_without_location,
    COUNT(*) FILTER (WHERE "closeDate" IS NOT NULL AND "location" IS NOT NULL) as closed_stores_with_location
FROM store;

-- 2. 업종별 폐업 점포 수 확인
SELECT 
    "sector",
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE "closeDate" IS NOT NULL) as closed_count,
    COUNT(*) FILTER (WHERE "closeDate" IS NOT NULL AND "location" IS NULL) as closed_without_location,
    COUNT(*) FILTER (WHERE "closeDate" IS NOT NULL AND "location" IS NOT NULL) as closed_with_location
FROM store
GROUP BY "sector"
ORDER BY closed_count DESC
LIMIT 20;

-- 3. C10 업종의 폐업 점포 샘플 확인
SELECT 
    id,
    "storeName",
    "sector",
    "openDate",
    "closeDate",
    CASE WHEN "location" IS NULL THEN 'NULL' ELSE 'OK' END as location_status,
    "address"
FROM store
WHERE "sector" = 'C10' AND "closeDate" IS NOT NULL
ORDER BY "closeDate" DESC
LIMIT 10;

-- 4. location이 NULL인 폐업 점포 확인 (삭제되었을 가능성이 있는 데이터)
SELECT 
    COUNT(*) as deleted_closed_stores_count
FROM store
WHERE "closeDate" IS NOT NULL 
  AND "location" IS NULL
  AND ("sector" IS NULL OR "openDate" IS NULL OR "location" IS NULL);
  
-- 주의: 위 쿼리는 현재 남아있는 데이터만 확인합니다.
-- fix-open-date-nulls.sql을 실행했다면 이미 삭제되었을 수 있습니다.

