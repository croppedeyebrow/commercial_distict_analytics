import os
import time
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

# 프로젝트 루트에서 .env 파일 로드
load_dotenv()

# --- 1. 환경 변수 설정 및 API 인증 정보 ---
DB_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
KAKAO_API_KEY = os.getenv("KAKAO_API_KEY")

# API 설정
KAKAO_API_URL = "https://dapi.kakao.com/v2/local/search/address.json"
HEADERS = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}

# **[추가/수정] 일일 무료 할당량 설정**
DAILY_LIMIT = 100000 

# --- 2. DB 연결 설정 ---
try:
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
except Exception as e:
    print(f"ERROR: Could not create DB engine. Check .env file. Error: {e}")
    exit()

# --- 3. 지오코딩 함수 ---
def geocode_address(address):
    """카카오 API를 사용하여 주소를 위경도로 변환합니다."""
    params = {'query': address}
    
    if not KAKAO_API_KEY or KAKAO_API_KEY == "YOUR_REST_API_KEY_HERE":
        print("ERROR: KAKAO_API_KEY가 .env 파일에 설정되지 않았습니다.")
        return None, None
        
    try:
        response = requests.get(KAKAO_API_URL, headers=HEADERS, params=params)
        response.raise_for_status() 
        data = response.json()
        
        if data['documents']:
            doc = data['documents'][0]
            lon = doc['x'] # 경도 (Longitude)
            lat = doc['y'] # 위도 (Latitude)
            return lon, lat
        
    except requests.exceptions.HTTPError as e:
        print(f"API HTTP Error for {address}. Status: {response.status_code}. Message: {response.text}")
        if response.status_code == 429:
             # 할당량 초과가 감지되면 예외를 발생시켜 메인 루프를 중단
            print("RATE LIMIT EXCEEDED (429). Stopping script. Please try again tomorrow.")
            raise
        
    except Exception as e:
        print(f"General Error during geocoding: {e}")
        
    return None, None

# --- 4. 메인 Geocoding 실행 함수 ---
def run_geocoding():
    session = Session()
    batch_size = 1000 
    
    print("Starting Geocoding Process...")
    print(f"Daily processing limit: {DAILY_LIMIT} requests.")
    
    try:
        total_geocoded_count = 0  # 전체 DB에 반영된 수 (이전 세션 포함)
        session_geocoded_count = 0 # 이번 세션에서 처리한 수

        while session_geocoded_count < DAILY_LIMIT: # [수정] 10만 건 미만일 때만 반복
            
            # 남은 할당량 계산 후 배치 사이즈 조정
            remaining_limit = DAILY_LIMIT - session_geocoded_count
            current_limit = min(batch_size, remaining_limit)

            if current_limit <= 0:
                print(f"Daily limit of {DAILY_LIMIT} reached. Stopping now.")
                break

            # location이 NULL인 행을 current_limit 만큼 가져옵니다.
            query = text(f"""
                SELECT id, address
                FROM store
                WHERE location IS NULL AND address IS NOT NULL
                LIMIT {current_limit};
            """)
            
            result = session.execute(query).fetchall()
            
            if not result:
                print("No more un-geocoded addresses found. Job complete.")
                break 
            
            print(f"\n-> Processing batch of {len(result)} addresses (Limit remaining: {remaining_limit})...")
            
            update_data = []
            
            for id, address in result:
                # [점검] 이미 일일 제한에 도달했는지 다시 한번 확인
                if session_geocoded_count >= DAILY_LIMIT:
                    break
                    
                lon, lat = geocode_address(address)
                
                if lon and lat:
                    wkt_point = f"POINT({lon} {lat})"
                    update_data.append({
                        'id': id, 
                        'wkt': wkt_point
                    })
                    session_geocoded_count += 1 # 성공 카운트 증가
                
                # API 사용량 제한을 위해 딜레이 (초당 20회 요청 제한 회피)
                time.sleep(0.05) 

            # 5. DB 업데이트
            if update_data:
                print(f"Updating {len(update_data)} rows with coordinates...")
                
                update_sql = text("""
                    UPDATE store
                    SET 
                        location_wkt = :wkt,
                        location = ST_SetSRID(ST_GeomFromText(:wkt), 4326)
                    WHERE 
                        id = :id;
                """)
                
                session.execute(update_sql, update_data)
                session.commit()
                total_geocoded_count += len(update_data)
                
            else:
                 print("No valid coordinates found in this batch or addresses skipped.")
            
    except Exception as e:
        session.rollback()
        print(f"\nCRITICAL ERROR: Stopping Geocoding process. Total successful updates in this session: {session_geocoded_count}. Error: {e}")
        
    finally:
        session.close()
        print(f"\n==========================================================")
        print(f"Geocoding Session Finished. Updates this session: {session_geocoded_count}")
        print(f"If the limit was reached, please run the script again tomorrow.")
        print(f"==========================================================")


if __name__ == "__main__":
    run_geocoding()