# 데이터 활용 공부\_상권 분석 프로젝트 : 파이썬 ETL 및 nest.js 백엔드 구성.

---

## 📚 중점 학습 사항 및 실습 목표

> 현재 잡 마켓의 백엔드 및 데이터 역량을 강화하기 위해 다음 네 가지에 중점을 두고 학습.

1. **데이터베이스 쿼리 최적화 (PostgreSQL/PostGIS)**
2. **백엔드/서빙 과정의 성능 최적화 (Nest.js + Redis)**
3. **데이터 엔지니어링 및 파이프라인 (초경량 ETL)**
4. **프론트엔드 시각화 성능 최적화 (Unity 또는 Map/Tailwind)**

## Nest.js

### nest.js 백엔드.

---

## Python

### 파이썬 인터프리터 : UV 사용.

##### 공식 설치 스크립트를 사용하여 설치 : 파워셀 관리자 권한 사용.

[powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"]

- 설치 후에는

  - [uv --version 통해 확인 , 새로운 파워셀 창에서]
  - uv를 설치한 디렉토리에서 uv venv 통해 가상환경 생성.

    - 이 명령은 **.venv**라는 폴더를 생성하고, 시스템에 설치된 기본 파이썬 버전을 사용하여 가상 환경을 만듭니다. 이 과정이 venv 모듈을 사용하는 것보다 훨씬 빠름.
      <img width="221" height="25" alt="image" src="https://github.com/user-attachments/assets/940661d0-07d8-48a8-8911-f027465b16d2" />

  - 필수 라이브러리 설치.

    - uv pip install pandas psycopg2-binary openpyxl
      <img width="335" height="192" alt="image" src="https://github.com/user-attachments/assets/aab61300-06d7-4c3c-a599-dc5ab03df788" />

  - 가상환경 활성화.
    - .\.venv\Scripts\activate
  - 활성화 확인.
    - 파워셀 명령창에 프롬프트가 **(.venv) PS** 로 변경되면 활성화 완료.
  - 의존성 목록 기록.
    - uv pip freeze > requirements.txt.
