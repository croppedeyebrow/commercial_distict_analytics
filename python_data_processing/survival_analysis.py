"""
생존 기간 분석 스크립트

폐업한 점포들의 개업일과 폐업일을 비교하여 업종별 평균 생존 일수를 계산하고,
survival_analysis 테이블에 저장합니다.

사용 방법:
    python survival_analysis.py
"""

import os
import logging
from datetime import datetime
from typing import Optional
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv

# 프로젝트 루트에서 .env 파일 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('survival_analysis.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def get_db_connection() -> Optional[create_engine]:
    """
    PostgreSQL 데이터베이스 연결을 생성합니다.
    
    Returns:
        create_engine 객체 또는 None (연결 실패 시)
    """
    try:
        db_url = (
            f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
            f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
        )
        engine = create_engine(db_url)
        logger.info("데이터베이스 연결 성공")
        return engine
    except Exception as e:
        logger.error(f"데이터베이스 연결 실패: {e}")
        return None


def fetch_closed_stores(engine: create_engine) -> pd.DataFrame:
    """
    폐업한 점포 데이터를 조회합니다.
    
    Args:
        engine: SQLAlchemy 엔진 객체
        
    Returns:
        폐업 점포 데이터를 담은 pandas DataFrame
    """
    query = text("""
        SELECT 
            sector,
            open_date,
            close_date
        FROM store
        WHERE close_date IS NOT NULL
          AND open_date IS NOT NULL
          AND sector IS NOT NULL
    """)
    
    try:
        df = pd.read_sql(query, engine)
        logger.info(f"폐업 점포 데이터 조회 완료: {len(df)}건")
        return df
    except Exception as e:
        logger.error(f"폐업 점포 데이터 조회 실패: {e}")
        raise


def calculate_survival_duration(df: pd.DataFrame) -> pd.DataFrame:
    """
    생존 일수를 계산하고 업종별 평균을 산출합니다.
    
    Args:
        df: 폐업 점포 데이터 DataFrame
        
    Returns:
        업종별 평균 생존 일수와 샘플 크기를 담은 DataFrame
    """
    if df.empty:
        logger.warning("폐업 점포 데이터가 없습니다.")
        return pd.DataFrame()
    
    # 생존 일수 계산
    df['duration_days'] = (df['close_date'] - df['open_date']).dt.days
    
    # 음수 값 제거 (데이터 오류 방지)
    initial_count = len(df)
    df = df[df['duration_days'] >= 0]
    removed_count = initial_count - len(df)
    
    if removed_count > 0:
        logger.warning(f"음수 생존 일수 데이터 {removed_count}건 제거됨")
    
    if df.empty:
        logger.warning("유효한 생존 일수 데이터가 없습니다.")
        return pd.DataFrame()
    
    # 업종별 평균 계산
    result = df.groupby('sector').agg({
        'duration_days': ['mean', 'count']
    }).reset_index()
    
    result.columns = ['sector', 'avg_duration_days', 'sample_size']
    
    # 소수점 2자리 반올림
    result['avg_duration_days'] = result['avg_duration_days'].round(2)
    
    logger.info(f"업종별 평균 생존 일수 계산 완료: {len(result)}개 업종")
    return result


def save_to_database(engine: create_engine, result: pd.DataFrame) -> None:
    """
    계산 결과를 survival_analysis 테이블에 저장합니다 (UPSERT).
    
    Args:
        engine: SQLAlchemy 엔진 객체
        result: 업종별 평균 생존 일수 DataFrame
    """
    if result.empty:
        logger.warning("저장할 데이터가 없습니다.")
        return
    
    now = datetime.now()
    upsert_query = text("""
        INSERT INTO survival_analysis (
            sector, avg_duration_days, sample_size, calculated_at, updated_at
        )
        VALUES (:sector, :avg_duration_days, :sample_size, :calculated_at, :updated_at)
        ON CONFLICT (sector)
        DO UPDATE SET
            avg_duration_days = EXCLUDED.avg_duration_days,
            sample_size = EXCLUDED.sample_size,
            updated_at = EXCLUDED.updated_at
    """)
    
    try:
        with engine.connect() as conn:
            for _, row in result.iterrows():
                conn.execute(upsert_query, {
                    'sector': row['sector'],
                    'avg_duration_days': float(row['avg_duration_days']),
                    'sample_size': int(row['sample_size']),
                    'calculated_at': now,
                    'updated_at': now
                })
            conn.commit()
        
        logger.info(f"survival_analysis 테이블에 {len(result)}개 업종 데이터 저장 완료")
        
        # 결과 출력
        logger.info("\n=== 계산 결과 ===")
        logger.info(result.to_string(index=False))
        
    except SQLAlchemyError as e:
        logger.error(f"데이터베이스 저장 실패: {e}")
        raise


def main():
    """
    메인 실행 함수
    """
    logger.info("=== 생존 기간 분석 시작 ===")
    
    # 1. 데이터베이스 연결
    engine = get_db_connection()
    if engine is None:
        logger.error("데이터베이스 연결 실패로 종료합니다.")
        return
    
    try:
        # 2. 폐업 점포 데이터 조회
        df = fetch_closed_stores(engine)
        
        if df.empty:
            logger.warning("분석할 데이터가 없습니다.")
            return
        
        # 3. 생존 일수 계산 및 업종별 평균 산출
        result = calculate_survival_duration(df)
        
        if result.empty:
            logger.warning("계산 결과가 없습니다.")
            return
        
        # 4. 결과를 데이터베이스에 저장
        save_to_database(engine, result)
        
        logger.info("=== 생존 기간 분석 완료 ===")
        
    except Exception as e:
        logger.error(f"분석 중 오류 발생: {e}", exc_info=True)
        raise
    finally:
        engine.dispose()
        logger.info("데이터베이스 연결 종료")


if __name__ == '__main__':
    main()

