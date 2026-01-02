# 상권 분석 대시보드 프론트엔드 기획서

**작성일**: 2026-01-02
**목적**: Next.js + TypeScript + shadcn/ui 기반 상권 분석 대시보드 기획서

---

## 🎯 개요

### 목표

- 백엔드 API를 활용한 실시간 상권 분석 대시보드 구축
- 직관적이고 사용하기 쉬운 UI/UX 제공
- 반응형 디자인으로 다양한 디바이스 지원
- 권한 관리는 백엔드에서 처리

### 기술 스택

- **Next.js**: React 프레임워크 (Page Router 방식)
- **TypeScript**: 타입 안정성 보장
- **shadcn/ui**: 컴포넌트 라이브러리 (CSS Modules로 스타일링)
- **CSS Modules**: 스타일링 (Tailwind 대신 사용, 가독성 향상)
- **React Query (TanStack Query)**: 서버 상태 관리 및 캐싱
- **Axios**: HTTP 클라이언트
- **D3.js**: 데이터 시각화 (고급 커스터마이징 가능)
- **Leaflet / Mapbox**: 지도 표시 (선택)

---

## 📦 프로젝트 구조

```
frontend/
├── public/                 # 정적 파일
├── src/
│   ├── app/               # Next.js App Router (사용 안 함)
│   ├── pages/             # Page Router (사용)
│   │   ├── _app.tsx       # 전역 설정
│   │   ├── _document.tsx  # HTML 문서 커스터마이징
│   │   ├── index.tsx      # 메인 대시보드
│   │   ├── map/           # 지도 페이지
│   │   │   └── index.tsx
│   │   ├── analysis/      # 분석 페이지들
│   │   │   ├── survival.tsx
│   │   │   ├── competition.tsx
│   │   │   ├── good-location.tsx
│   │   │   └── distribution.tsx
│   │   ├── stores/        # 점포 목록 페이지
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx   # 점포 상세
│   │   └── api/           # API 라우트 (프록시 등)
│   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── ui/            # shadcn/ui 컴포넌트
│   │   ├── layout/        # 레이아웃 컴포넌트
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── dashboard/     # 대시보드 전용 컴포넌트
│   │   │   ├── StatsCard.tsx
│   │   │   ├── SurvivalChart.tsx
│   │   │   ├── CompetitionHeatmap.tsx
│   │   │   └── LocationScoreCard.tsx
│   │   ├── map/           # 지도 관련 컴포넌트
│   │   │   ├── MapView.tsx
│   │   │   ├── StoreMarker.tsx
│   │   │   └── RadiusSelector.tsx
│   │   └── analysis/         # 분석 관련 컴포넌트
│   │       ├── SectorFilter.tsx
│   │       ├── AnalysisResult.tsx
│   │       └── GoodLocationCard.tsx
│   ├── lib/               # 유틸리티 및 설정
│   │   ├── api/           # API 클라이언트
│   │   │   ├── client.ts
│   │   │   ├── spatial.ts
│   │   │   ├── analysis.ts
│   │   │   └── stores.ts
│   │   ├── hooks/         # 커스텀 훅
│   │   │   ├── useStores.ts
│   │   │   ├── useAnalysis.ts
│   │   │   └── useMap.ts
│   │   ├── utils/         # 유틸리티 함수
│   │   │   ├── format.ts
│   │   │   ├── validation.ts
│   │   │   └── constants.ts
│   │   └── types/         # TypeScript 타입 정의
│   │       ├── api.ts
│   │       ├── store.ts
│   │       └── analysis.ts
│   └── styles/            # 전역 스타일
│       └── globals.css
├── components.json        # shadcn/ui 설정
├── next.config.js         # Next.js 설정
├── tsconfig.json          # TypeScript 설정
├── tailwind.config.js     # Tailwind CSS 설정
└── package.json
```

---

## 🚀 설치 및 설정

### 1. Next.js 프로젝트 생성

```bash
npx create-next-app@latest frontend --typescript --tailwind --app=false
cd frontend
```

### 2. 필수 패키지 설치

```bash
# shadcn/ui 초기화 (CSS Modules 모드로 설정)
npx shadcn-ui@latest init

# 필수 라이브러리
npm install @tanstack/react-query

# HTTP 클라이언트
npm install axios

# D3.js 및 React 래퍼
npm install d3 @types/d3
npm install react-d3-library          # 선택: React 래퍼 (필요시)

# 지도 (선택)
npm install leaflet react-leaflet
npm install @types/leaflet

# 개발 의존성
npm install -D @types/node @types/d3
```

### 3. shadcn/ui 컴포넌트 설치 (CSS Modules 모드)

```bash
# components.json에서 style을 "new-york" 또는 "default"로 설정
# tailwindcss는 false로 설정 (CSS Modules 사용)

# 자주 사용할 컴포넌트들
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add skeleton
```

**참고**: shadcn/ui는 기본적으로 Tailwind를 사용하지만, CSS Modules로도 사용 가능합니다. 각 컴포넌트의 스타일을 CSS Modules로 변환하거나, 커스텀 스타일을 직접 작성할 수 있습니다.

---

## 📐 페이지 구조 및 라우팅

### 1. 메인 대시보드 (`/`)

**경로**: `pages/index.tsx`

**기능**:

- 전체 상권 분석 개요
- 주요 지표 카드 (StatsCard)
- 최근 개업 점포 현황
- 생존 기간 분포 차트
- 빠른 분석 링크

**API 연동**:

- `GET /analysis/stores/openings` - 개업 현황
- `GET /analysis/survival/distribution` - 생존 분포
- `GET /stores?limit=10` - 최근 점포

**컴포넌트**:

- `StatsCard` - 지표 카드
- `SurvivalDistributionChart` - 생존 분포 차트
- `RecentStoresList` - 최근 점포 목록

---

### 2. 지도 뷰 (`/map`)

**경로**: `pages/map/index.tsx`

**기능**:

- 인터랙티브 지도 (Leaflet 또는 Mapbox)
- 반경 선택 슬라이더 (100m ~ 2000m)
- 업종 필터 드롭다운
- 점포 마커 표시
- 클릭 시 상세 정보 표시
- 3D 뷰 전환 버튼 (향후 R3F 연동)

**API 연동**:

- `GET /spatial/stores-within-radius-enhanced` - 반경 내 점포

**컴포넌트**:

- `MapView` - 지도 컨테이너
- `StoreMarker` - 점포 마커
- `RadiusSelector` - 반경 선택
- `SectorFilter` - 업종 필터
- `StoreDetailDialog` - 점포 상세 정보

**상태 관리**:

- 현재 중심 좌표 (lat, lng)
- 선택된 반경
- 선택된 업종
- 표시할 점포 목록

---

### 3. 생존 분석 (`/analysis/survival`)

**경로**: `pages/analysis/survival.tsx`

**기능**:

- 업종별 평균 생존 기간 표시
- 업종 필터 선택
- 생존 기간 차트 (Bar Chart)
- 생존 분포 차트 (Pie Chart)

**API 연동**:

- `GET /analysis/survival?sector={sector}` - 평균 생존 기간
- `GET /analysis/survival/distribution?sector={sector}` - 생존 분포

**컴포넌트**:

- `SurvivalChart` - 생존 기간 차트
- `SurvivalDistributionChart` - 생존 분포 차트
- `SectorFilter` - 업종 필터

---

### 4. 경쟁 강도 분석 (`/analysis/competition`)

**경로**: `pages/analysis/competition.tsx`

**기능**:

- 지도에서 위치 선택
- 반경 설정
- 업종 선택
- 경쟁 강도 결과 표시
- 히트맵 시각화 (선택)

**API 연동**:

- `GET /analysis/competition?lat={lat}&lon={lng}&radiusMeters={radius}&sector={sector}`

**컴포넌트**:

- `MapView` - 지도
- `CompetitionResult` - 경쟁 강도 결과
- `CompetitionHeatmap` - 히트맵 (선택)

---

### 5. 좋은 자리 체크 (`/analysis/good-location`)

**경로**: `pages/analysis/good-location.tsx`

**기능**:

- 지도에서 위치 선택
- 업종 선택 (필수)
- 반경 설정
- 종합 평가 결과 표시
  - 생존가능성 점수
  - 경쟁 강도 점수
  - 접근성 점수
  - 업종 적합성 점수
- 위험 요소 / 기회 요소 표시
- 권장사항 표시

**API 연동**:

- `GET /analysis/good-location?lat={lat}&lng={lng}&sector={sector}&radius={radius}`
- `GET /analysis/survival-score?lat={lat}&lng={lng}&radius={radius}&sector={sector}`

**컴포넌트**:

- `MapView` - 지도
- `GoodLocationCard` - 종합 평가 카드
- `ScoreRadarChart` - 점수 레이더 차트
- `RiskOpportunityList` - 위험/기회 요소
- `RecommendationsList` - 권장사항

---

### 6. 점포 목록 (`/stores`)

**경로**: `pages/stores/index.tsx`

**기능**:

- 점포 목록 테이블
- 페이징
- 업종 필터
- 검색 (점포명, 주소)
- 정렬 (개업일, 업종)
- 상세 보기 링크

**API 연동**:

- `GET /stores?page={page}&limit={limit}&sector={sector}`

**컴포넌트**:

- `StoresTable` - 점포 테이블
- `Pagination` - 페이징
- `SectorFilter` - 업종 필터
- `SearchInput` - 검색 입력

---

### 7. 점포 상세 (`/stores/[id]`)

**경로**: `pages/stores/[id].tsx`

**기능**:

- 점포 기본 정보
- 위치 지도 표시
- 주변 점포 분석
- 생존 기간 정보

**API 연동**:

- `GET /spatial/stores-within-radius-enhanced?lat={lat}&lng={lng}&radius=500`
- `GET /analysis/competition?lat={lat}&lon={lng}&radiusMeters=500&sector={sector}`

---

## 🎨 UI/UX 설계

### 1. 레이아웃 구조

```
┌─────────────────────────────────────────┐
│ Header (로고, 네비게이션, 사용자 정보)  │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │   Main Content Area          │
│          │                              │
│ - 대시보드│   - 페이지별 콘텐츠          │
│ - 지도    │   - 차트, 테이블, 지도       │
│ - 분석    │   - 필터, 검색               │
│ - 점포    │                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

### 2. 색상 테마

- **Primary**: 생존가능성 높음 (녹색 계열)
- **Warning**: 주의 필요 (노란색 계열)
- **Danger**: 위험 (빨간색 계열)
- **Info**: 정보 (파란색 계열)

### 3. 반응형 디자인

- **Desktop**: 사이드바 + 메인 콘텐츠
- **Tablet**: 접을 수 있는 사이드바
- **Mobile**: 하단 네비게이션 바
- **AIX(AI-user-Experience)**: 사용자 경험 최적화
- **ZeroUI:AI가 맥락을 해석해 단순한 플로우제공**
- **SOFT UI : 부드러운 3D 글래스모피즘**

---

## 🔧 핵심 컴포넌트 설계

### 1. API 클라이언트 설정 (Axios)

```typescript
// lib/api/client.ts
import axios, { AxiosInstance, AxiosError } from "axios";

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터: 토큰 추가
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // 권한 없음 - 백엔드에서 처리
      // 필요시 리다이렉트
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 2. React Query 설정 (`pages/_app.tsx`)

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5분
    },
  },
});

function MyApp({ Component, pageProps }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default MyApp;
```

### 3. 커스텀 훅 예시 (`lib/hooks/useStores.ts`)

```typescript
import { useQuery } from "@tanstack/react-query";
import { storesApi } from "@/lib/api/stores";

export function useStores(params: {
  page?: number;
  limit?: number;
  sector?: string;
}) {
  return useQuery({
    queryKey: ["stores", params],
    queryFn: () => storesApi.getStores(params),
  });
}

export function useStoresWithinRadius(params: {
  lat: number;
  lng: number;
  radius: number;
  sector?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
}) {
  return useQuery({
    queryKey: ["stores-within-radius", params],
    queryFn: () => storesApi.getStoresWithinRadius(params),
    enabled: !!params.lat && !!params.lng, // 좌표가 있을 때만 실행
  });
}
```

### 4. StatsCard 컴포넌트 (CSS Modules 사용)

```typescript
// components/dashboard/StatsCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import styles from "./StatsCard.module.css"; // CSS Modules

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
}

export function StatsCard({ title, value, trend, icon }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={styles.value}>{value}</div>
        {trend && (
          <p
            className={`${styles.trend} ${
              trend.isPositive ? styles.positive : styles.negative
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className={styles.icon} />
            ) : (
              <TrendingDown className={styles.icon} />
            )}
            {Math.abs(trend.value)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

```css
/* components/dashboard/StatsCard.module.css */
.header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
}

.title {
  font-size: 0.875rem;
  font-weight: 500;
}

.value {
  font-size: 1.5rem;
  font-weight: bold;
}

.trend {
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  margin-top: 0.25rem;
}

.positive {
  color: #16a34a; /* green-600 */
}

.negative {
  color: #dc2626; /* red-600 */
}

.icon {
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.25rem;
}
```

---

## 🔐 권한 관리

### 백엔드 권한 체크

- 모든 API 요청은 백엔드에서 권한 검증
- 401 Unauthorized 응답 시 로그인 페이지로 리다이렉트
- 토큰은 localStorage 또는 httpOnly cookie에 저장

### 프론트엔드 권한 처리

```typescript
// lib/utils/auth.ts
export function handleAuthError(error: any) {
  if (error.response?.status === 401) {
    // 로그인 페이지로 리다이렉트
    window.location.href = "/login";
  }
}
```

---

## 📊 데이터 시각화

### 1. D3.js 사용

**장점**:

- 강력한 커스터마이징 가능
- 다양한 시각화 타입 지원
- 데이터 바인딩 및 애니메이션 제어
- SVG 기반으로 확장성 우수

**사용 예시**:

- 생존 기간 분포: D3 Pie Chart
- 업종별 생존 기간: D3 Bar Chart
- 점수 비교: D3 Radar Chart
- 히트맵: D3 Heatmap

**D3.js React 통합 예시**:

```typescript
// components/dashboard/SurvivalChart.tsx
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import styles from "./SurvivalChart.module.css";

interface SurvivalChartProps {
  data: Array<{ sector: string; averageDays: number }>;
}

export function SurvivalChart({ data }: SurvivalChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // 기존 차트 제거

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.sector))
      .range([0, width])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.averageDays) || 0])
      .nice()
      .range([height, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // X축
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

    // Y축
    g.append("g").call(d3.axisLeft(y));

    // 바 차트
    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", styles.bar)
      .attr("x", (d) => x(d.sector) || 0)
      .attr("y", (d) => y(d.averageDays))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.averageDays))
      .attr("fill", "#3b82f6");
  }, [data]);

  return (
    <div className={styles.chartContainer}>
      <svg ref={svgRef} width={600} height={400}></svg>
    </div>
  );
}
```

```css
/* components/dashboard/SurvivalChart.module.css */
.chartContainer {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 1rem;
}

.bar {
  transition: fill 0.3s ease;
}

.bar:hover {
  fill: #2563eb;
}
```

### 2. 지도 라이브러리: Leaflet

**장점**:

- 무료
- 오픈소스
- 커스터마이징 용이

**대안**: Mapbox (유료, 더 많은 기능)

---

## 🎯 구현 단계

### Phase 1: 기본 구조 및 레이아웃 (1주)

- [ ] Next.js 프로젝트 설정
- [ ] shadcn/ui 설치 및 설정
- [ ] 레이아웃 컴포넌트 (Header, Sidebar, Footer)
- [ ] 라우팅 구조 설정
- [ ] API 클라이언트 설정
- [ ] React Query 설정

### Phase 2: 메인 대시보드 (1주)

- [ ] StatsCard 컴포넌트
- [ ] 개업 현황 표시
- [ ] 생존 분포 차트
- [ ] 최근 점포 목록

### Phase 3: 지도 뷰 (1주)

- [ ] Leaflet 지도 통합
- [ ] 반경 선택 슬라이더
- [ ] 업종 필터
- [ ] 점포 마커 표시
- [ ] 클릭 이벤트 처리

### Phase 4: 분석 페이지들 (2주)

- [ ] 생존 분석 페이지
- [ ] 경쟁 강도 분석 페이지
- [ ] 좋은 자리 체크 페이지
- [ ] 점수 시각화 (Radar Chart)

### Phase 5: 점포 목록 및 상세 (1주)

- [ ] 점포 목록 테이블
- [ ] 페이징
- [ ] 검색 및 필터
- [ ] 점포 상세 페이지

### Phase 6: 최적화 및 개선 (1주)

- [ ] 로딩 상태 처리
- [ ] 에러 처리
- [ ] 반응형 디자인 개선
- [ ] 성능 최적화
- [ ] 접근성 개선

---

## 📝 주요 API 연동

```typescript
// lib/api/spatial.ts
import apiClient from "./client";

export const spatialApi = {
  getStoresWithinRadius: async (params: {
    lat: number;
    lng: number;
    radius: number;
    sector?: string;
  }) => {
    const response = await apiClient.get("/spatial/stores-within-radius", {
      params: {
        lat: params.lat,
        lng: params.lng,
        radius: params.radius,
        ...(params.sector && { sector: params.sector }),
      },
    });
    return response.data;
  },

  getStoresWithinRadiusEnhanced: async (params: {
    lat: number;
    lng: number;
    radius: number;
    sector?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
  }) => {
    const response = await apiClient.get(
      "/spatial/stores-within-radius-enhanced",
      {
        params: {
          lat: params.lat,
          lng: params.lng,
          radius: params.radius,
          ...(params.sector && { sector: params.sector }),
          ...(params.page && { page: params.page }),
          ...(params.limit && { limit: params.limit }),
          ...(params.sortBy && { sortBy: params.sortBy }),
        },
      }
    );
    return response.data;
  },
};
```

### Analysis API 예시

```typescript
// lib/api/analysis.ts
import apiClient from "./client";

export const analysisApi = {
  getStoreOpeningSnapshot: async (limit?: number) => {
    const response = await apiClient.get("/analysis/stores/openings", {
      params: { limit },
    });
    return response.data;
  },

  getSurvival: async (sector?: string) => {
    const response = await apiClient.get("/analysis/survival", {
      params: { sector },
    });
    return response.data;
  },

  getSurvivalDistribution: async (sector?: string) => {
    const response = await apiClient.get("/analysis/survival/distribution", {
      params: { sector },
    });
    return response.data;
  },

  getCompetition: async (params: {
    lat: number;
    lon: number;
    radiusMeters: number;
    sector: string;
  }) => {
    const response = await apiClient.get("/analysis/competition", {
      params,
    });
    return response.data;
  },

  getSurvivalScore: async (params: {
    lat: number;
    lng: number;
    radius?: number;
    sector?: string;
  }) => {
    const response = await apiClient.get("/analysis/survival-score", {
      params,
    });
    return response.data;
  },

  getGoodLocation: async (params: {
    lat: number;
    lng: number;
    sector: string;
    radius?: number;
  }) => {
    const response = await apiClient.get("/analysis/good-location", {
      params,
    });
    return response.data;
  },
};
```

---

## 🎨 shadcn/ui 컴포넌트 활용

### 주요 사용 컴포넌트

1. **Card**: 통계 카드, 결과 표시
2. **Button**: 액션 버튼
3. **Input**: 검색, 좌표 입력
4. **Select**: 업종 필터, 정렬 옵션
5. **Slider**: 반경 선택
6. **Table**: 점포 목록
7. **Dialog**: 상세 정보 모달
8. **Tabs**: 분석 결과 탭
9. **Badge**: 상태 표시
10. **Skeleton**: 로딩 상태

---

## ⚠️ 주의사항

1. **Axios 사용**:

   - 풍부한 기능 제공 (인터셉터, 자동 JSON 변환 등)
   - 널리 사용되는 라이브러리로 커뮤니티 지원 우수
   - TypeScript 지원 우수

2. **CSS Modules 사용**: Tailwind 대신 CSS Modules 사용

   - 각 컴포넌트에 `.module.css` 파일 생성
   - 클래스명은 camelCase로 작성
   - shadcn/ui 컴포넌트는 기본 Tailwind 스타일이지만, CSS Modules로 오버라이드 가능

3. **D3.js 학습 곡선**: D3.js는 학습 곡선이 있지만, 강력한 커스터마이징 가능

   - React와 함께 사용 시 `useEffect`와 `useRef` 활용
   - 컴포넌트 언마운트 시 D3 선택 요소 정리 필요

4. **환경 변수**: API URL은 `.env.local`에 설정

   - `NEXT_PUBLIC_API_URL`: REST API URL

5. **CORS**: 백엔드에서 CORS 설정 필요

6. **에러 처리**: 모든 API 호출에 에러 처리 필요

7. **로딩 상태**: 사용자 경험을 위해 로딩 상태 표시

8. **타입 안정성**: REST API 사용 시 TypeScript 타입 정의 필수

9. **성능**: React Query 캐싱 활용

10. **접근성**: 키보드 네비게이션, 스크린 리더 지원

---

## 📚 참고 자료

- [Next.js 공식 문서](https://nextjs.org/docs)
- [shadcn/ui 문서](https://ui.shadcn.com/)
- [React Query 문서](https://tanstack.com/query/latest)
- [D3.js 공식 문서](https://d3js.org/)
- [D3.js 갤러리](https://observablehq.com/@d3/gallery)
- [Axios 공식 문서](https://axios-http.com/)
- [CSS Modules 문서](https://github.com/css-modules/css-modules)
- [Leaflet 문서](https://leafletjs.com/)

---

**다음 단계**: Phase 1부터 시작하여 단계적으로 구현 진행
