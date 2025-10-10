import os
import glob
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# 프로젝트 루트에서 .env 파일 로드
# 이 파일에서 DB 접속 정보를 읽어옵니다.
load_dotenv()

# --- 1. 환경 변수 설정 ---
DB_HOST = os.getenv("POSTGRES_HOST")
DB_PORT = os.getenv("POSTGRES_PORT")
DB_USER = os.getenv("POSTGRES_USER")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")
DB_NAME = os.getenv("POSTGRES_DB")

# PostgreSQL 연결 문자열 (Connection String) 생성
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# --- 2. 설정 및 상수 ---
# CSV 파일 경로 (프로젝트 루트 기준)
DATA_PATH = "data/*.csv" 
TARGET_TABLE = "store"

# CSV 파일에서 추출할 필수 컬럼 정의 (데이터 정합성 확보)
REQUIRED_COLUMNS = [
    "업소명",  # storeName
    "업종명", # sector
    "소재지도로명", # address
    "허가신고일", # openDate
    "폐업일자"   # closeDate
]
# DB 컬럼명과 매핑
COLUMN_MAPPING = {
    "업소명": "storeName",
    "업종명": "sector",
    "소재지도로명": "address",
    "허가신고일": "openDate",
    "폐업일자": "closeDate"
}

# --- 3. ETL 함수 정의 ---

def connect_to_db():
    """데이터베이스 연결 엔진을 생성하고 반환합니다."""
    print(f"Connecting to database: {DB_NAME}...")
    try:
        engine = create_engine(DATABASE_URL)
        # 연결 테스트
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            if result.scalar() == 1:
                print("Database connection successful!")
                return engine
    except SQLAlchemyError as e:
        print(f"Database connection failed: {e}")
        return None

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    데이터프레임을 클리닝하고 DB 스키마에 맞게 변환합니다.
    """
    print("Starting data cleaning and transformation...")

    # 1. 컬럼 이름 변경 및 불필요한 컬럼 제거
    df = df.rename(columns=COLUMN_MAPPING)
    df = df[COLUMN_MAPPING.values()]

    # 2. 날짜 형식 변환 및 결측치 처리
    # 허가신고일과 폐업일자는 'YYYYMMDD' 형식으로 되어있으므로, 'YYYY-MM-DD'로 변환
    for col in ["openDate", "closeDate"]:
        # 숫자를 문자열로 변환 (날짜가 숫자형인 경우)
        df[col] = df[col].astype(str).str.replace('/', '').str.replace('-', '').str.replace(' ', '')
        # 날짜 형식이 아니거나 NaN인 경우 NaT(Not a Time)로 변환
        df[col] = pd.to_datetime(df[col], format="%Y%m%d", errors='coerce')
    
    # 3. 필수 데이터 확인 및 결측치 제거
    # storeName과 address가 비어있으면 의미없는 데이터이므로 제거
    df.dropna(subset=['storeName', 'address'], inplace=True)
    # 빈 문자열도 제거
    df = df[df['storeName'].str.strip() != '']
    df = df[df['address'].str.strip() != '']
    
    # 4. 초기 GEOMETRY 컬럼 (location)과 WKT 컬럼 (location_wkt) 추가
    # location_wkt는 임시로 주소 문자열을 보관하거나, None으로 처리
    df['location_wkt'] = None 
    # location 컬럼은 Geocoding 전이므로 일단 비워둠 (NULL)
    df['location'] = None

    print(f"Data cleaning complete. {len(df)} rows remaining.")
    return df

def run_etl():
    """전체 ETL 파이프라인을 실행합니다."""
    
    engine = connect_to_db()
    if not engine:
        return

    all_files = glob.glob(DATA_PATH)
    total_processed_rows = 0

    for file_path in all_files:
        print(f"\n--- Processing file: {file_path} ---")
        try:
            # 1. Extraction (추출)
            # 2019년도 파일은 세미콜론으로 구분되어 있음
            delimiter = ';' if '2019' in file_path else ','
            df = pd.read_csv(file_path, encoding='cp949', delimiter=delimiter, on_bad_lines='skip', low_memory=False) # 한글 인코딩 (CP949) 사용

            # 필수 컬럼 존재 여부 확인
            missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
            if missing_cols:
                print(f"Skipping file: {file_path}. Missing columns: {', '.join(missing_cols)}")
                continue

            # 2. Transformation (변환)
            df_cleaned = clean_data(df)
            
            if df_cleaned.empty:
                print(f"No valid data remaining in {file_path} after cleaning. Skipping insert.")
                continue

            # 3. Loading (적재)
            print(f"Inserting {len(df_cleaned)} rows into {TARGET_TABLE}...")
            
            # to_sql을 사용하여 데이터 적재
            # if_exists='append'는 기존 데이터에 추가
            # index=False는 DataFrame의 인덱스를 DB에 넣지 않음
            # method='multi'는 대량 삽입 성능 향상 (chunksize와 함께 사용)
            df_cleaned.to_sql(
                name=TARGET_TABLE,
                con=engine,
                if_exists='append',
                index=False,
                chunksize=10000,
                method='multi'
            )
            
            total_processed_rows += len(df_cleaned)
            print(f"Successfully inserted {len(df_cleaned)} rows from {file_path}.")

        except Exception as e:
            print(f"An error occurred while processing {file_path}: {e}")
            continue

    print(f"\n========================================================")
    print(f"ETL Process Complete. Total rows inserted: {total_processed_rows}")
    print(f"========================================================")


if __name__ == "__main__":
    run_etl()