-- survival_analysis 테이블 생성 스크립트
-- Python 배치 작업으로 사전 계산된 생존 기간 분석 결과를 저장하는 테이블

-- 1. 테이블이 이미 존재하는지 확인
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'survival_analysis'
) AS table_exists;

-- 2. 테이블 생성 (존재하지 않는 경우에만)
CREATE TABLE IF NOT EXISTS survival_analysis (
    sector VARCHAR(10) PRIMARY KEY,
    avg_duration_days DECIMAL(10, 2) NOT NULL,
    sample_size INTEGER NOT NULL,
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. 인덱스 생성 (sector는 PRIMARY KEY이므로 자동으로 인덱스가 생성되지만, 명시적으로 확인)
-- PRIMARY KEY는 자동으로 인덱스를 생성하므로 별도 인덱스 생성 불필요

-- 4. 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'survival_analysis'
ORDER BY ordinal_position;

-- 5. 인덱스 확인
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'survival_analysis';

-- 6. 테이블 생성 완료 확인
SELECT 
    COUNT(*) as row_count
FROM survival_analysis;

