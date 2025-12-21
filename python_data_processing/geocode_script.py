"""
================================================================================
주소-위경도 좌표 변환 스크립트.
================================================================================

이 스크립트는 PostgreSQL 데이터베이스의 store 테이블에 저장된 주소를 
카카오 지도 API를 사용하여 위경도 좌표로 변환합니다.

[작동 방식]
1. 데이터베이스에서 location이 NULL이고 address가 있는 레코드를 조회합니다.
2. ThreadPoolExecutor를 사용하여 최대 15개의 주소를 동시에 병렬 처리합니다.
   (카카오 API 초당 20회 제한을 고려한 안전한 설정)
3. 각 주소를 카카오 지도 API로 지오코딩하여 경도(lon), 위도(lat)를 획득합니다.
4. 변환된 좌표를 WKT(Well-Known Text) 형식으로 변환하여 데이터베이스에 저장합니다.
   - location_wkt: 텍스트 형식의 WKT 좌표
   - location: PostGIS의 POINT 타입으로 변환된 좌표 (SRID: 4326)

[주요 특징]
- 병렬 처리: 15개 스레드로 동시 처리하여 속도 최적화
- 일일 제한 관리: 하루 최대 100,000건 처리 제한 (DAILY_LIMIT)
- 배치 처리: 한 번에 최대 5,000건씩 처리
- Rate Limit 처리: API 429 에러 발생 시 자동 중단
- 에러 복구: 개별 주소 처리 실패 시에도 계속 진행

[필수 환경 변수 (.env 파일)]
- POSTGRES_USER: PostgreSQL 사용자명
- POSTGRES_PASSWORD: PostgreSQL 비밀번호
- POSTGRES_HOST: PostgreSQL 호스트
- POSTGRES_PORT: PostgreSQL 포트
- POSTGRES_DB: PostgreSQL 데이터베이스명
- KAKAO_API_KEY: 카카오 REST API 키

[사용 방법]
python geocode_script.py

================================================================================
"""

import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
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

# 병렬 처리 설정 (카카오 API 초당 20회 제한 고려)
MAX_WORKERS = 15  # 동시 처리 스레드 수 (초당 20회 제한 내에서 안전하게 설정) 

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
        response = requests.get(KAKAO_API_URL, headers=HEADERS, params=params, timeout=5)
        response.raise_for_status() 
        data = response.json()
        
        if data['documents']:
            doc = data['documents'][0]
            lon = doc['x'] # 경도 (Longitude)
            lat = doc['y'] # 위도 (Latitude)
            return lon, lat
        
    except requests.exceptions.HTTPError as e:
        if response.status_code == 429:
             # 할당량 초과가 감지되면 예외를 발생시켜 메인 루프를 중단
            print(f"RATE LIMIT EXCEEDED (429) for {address}. Stopping script. Please try again tomorrow.")
            raise
        print(f"API HTTP Error for {address}. Status: {response.status_code}. Message: {response.text}")
        
    except Exception as e:
        print(f"General Error during geocoding for {address}: {e}")
        
    return None, None

# --- 3-1. 병렬 처리를 위한 지오코딩 래퍼 함수 ---
def geocode_with_id(id_address_pair):
    """(id, address) 튜플을 받아서 지오코딩 결과와 함께 id를 반환합니다."""
    id, address = id_address_pair
    lon, lat = geocode_address(address)
    return id, lon, lat

# --- 4. 메인 Geocoding 실행 함수 ---
def run_geocoding():
    session = Session()
    # 병렬 처리 시 더 큰 배치 크기 사용 가능
    batch_size = 5000 
    
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
            rate_limit_exceeded = False
            
            # 병렬 처리로 여러 주소를 동시에 지오코딩
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                # 모든 작업을 제출
                future_to_pair = {
                    executor.submit(geocode_with_id, (id, address)): (id, address) 
                    for id, address in result
                    if session_geocoded_count < DAILY_LIMIT
                }
                
                # 완료된 작업부터 처리
                for future in as_completed(future_to_pair):
                    # 일일 제한 체크
                    if session_geocoded_count >= DAILY_LIMIT:
                        # 남은 작업 취소
                        for f in future_to_pair:
                            f.cancel()
                        break
                    
                    try:
                        id, lon, lat = future.result()
                        
                        if lon and lat:
                            wkt_point = f"POINT({lon} {lat})"
                            update_data.append({
                                'id': id, 
                                'wkt': wkt_point
                            })
                            session_geocoded_count += 1 # 성공 카운트 증가
                            
                    except requests.exceptions.HTTPError:
                        # 429 에러가 발생하면 모든 작업 중단 (geocode_address에서 이미 raise됨)
                        rate_limit_exceeded = True
                        for f in future_to_pair:
                            f.cancel()
                        break
                    except Exception as e:
                        # 개별 에러는 로그만 남기고 계속 진행
                        id, address = future_to_pair[future]
                        print(f"Error processing {address}: {e}")
            
            # Rate limit 초과 시 전체 프로세스 중단
            if rate_limit_exceeded:
                raise requests.exceptions.HTTPError("Rate limit exceeded (429)") 

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