-- 필수 컬럼 중 하나라도 null이 있는 레코드 삭제 스크립트
-- 필수 컬럼: sector, openDate, location (nullable: false)
-- 이 스크립트를 실행한 후 database.config.ts의 synchronize를 true로 변경할 수 있습니다

-- 1. 필수 컬럼 중 null이 있는 레코드 개수 확인
SELECT 
    COUNT(*) FILTER (WHERE "sector" IS NULL) as sector_null_count,
    COUNT(*) FILTER (WHERE "openDate" IS NULL) as openDate_null_count,
    COUNT(*) FILTER (WHERE "location" IS NULL) as location_null_count,
    COUNT(*) FILTER (WHERE "sector" IS NULL OR "openDate" IS NULL OR "location" IS NULL) as total_invalid_count
FROM store;

-- 2. 필수 컬럼 중 하나라도 null인 레코드 확인 (삭제 전 확인용)
SELECT id, "storeName", "sector", "openDate", "closeDate", 
       CASE WHEN "sector" IS NULL THEN 'NULL' ELSE 'OK' END as sector_status,
       CASE WHEN "openDate" IS NULL THEN 'NULL' ELSE 'OK' END as openDate_status,
       CASE WHEN "location" IS NULL THEN 'NULL' ELSE 'OK' END as location_status
FROM store 
WHERE "sector" IS NULL OR "openDate" IS NULL OR "location" IS NULL
LIMIT 10;

-- 3. 필수 컬럼 중 하나라도 null인 레코드 삭제
-- 주의: 이 작업은 되돌릴 수 없습니다. 삭제 전에 백업을 권장합니다.
DELETE FROM store 
WHERE "sector" IS NULL OR "openDate" IS NULL OR "location" IS NULL;

-- 4. 삭제 후 확인 (모두 0이 나와야 정상)
SELECT 
    COUNT(*) FILTER (WHERE "sector" IS NULL) as remaining_sector_nulls,
    COUNT(*) FILTER (WHERE "openDate" IS NULL) as remaining_openDate_nulls,
    COUNT(*) FILTER (WHERE "location" IS NULL) as remaining_location_nulls,
    COUNT(*) FILTER (WHERE "sector" IS NULL OR "openDate" IS NULL OR "location" IS NULL) as remaining_total_invalid
FROM store;

-- 5. 전체 레코드 수 확인
SELECT COUNT(*) as total_count 
FROM store;

