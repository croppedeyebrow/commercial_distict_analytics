# R3F를 활용한 3D 상권 분석 맵 기획서

**작성일**: 2025-12-21  
**목적**: React Three Fiber(R3F)를 활용하여 상권 분석 데이터를 3D로 시각화하는 종합 기획서

---

## 🎯 개요

### 목표

- 상권 분석 데이터를 3D 맵으로 시각화하여 사용자가 직관적으로 이해할 수 있도록 함
- 점포 밀도, 생존가능성 점수, 경쟁 강도 등을 3D 그래프로 표현
- 인터랙티브한 탐색 경험 제공
- React 생태계와 완벽하게 통합된 솔루션

### 기술 스택

- **React**: 프론트엔드 프레임워크
- **Three.js**: 3D 렌더링 엔진
- **@react-three/fiber (R3F)**: Three.js를 React 컴포넌트로 사용하는 라이브러리 (핵심)
- **@react-three/drei**: R3F용 유틸리티 라이브러리 (OrbitControls, Text 등)
- **Mapbox GL JS / Leaflet**: 2D 지도 기반 (선택)
- **D3.js**: 데이터 시각화 (선택)

---

## 📦 설치 및 설정

### 필수 패키지 설치

```bash
# 필수 패키지
npm install three @react-three/fiber

# 유틸리티 라이브러리 (강력히 권장)
npm install @react-three/drei

# TypeScript 사용 시
npm install --save-dev @types/three
```

### 왜 R3F를 사용하나요?

1. **React 스타일**: 컴포넌트 기반 선언적 코드
2. **자동 최적화**: React의 렌더링 최적화 활용
3. **TypeScript 지원**: 완벽한 타입 안정성
4. **생태계**: drei 등 풍부한 유틸리티 라이브러리
5. **학습 곡선**: Three.js를 직접 다루는 것보다 쉬움
6. **생명주기 관리**: React의 생명주기와 자연스럽게 통합

---

## 🚀 기본 사용법

### 1. 가장 간단한 예제

```jsx
import { Canvas } from "@react-three/fiber";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </mesh>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} />
      </Canvas>
    </div>
  );
}
```

### 2. 카메라 컨트롤 추가

```jsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function App() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />
      <OrbitControls />
    </Canvas>
  );
}
```

---

## 📊 시각화 요소

### 1. 3D 히트맵 (Heatmap)

#### 개념

- 지도 위에 점포 밀도나 생존가능성 점수를 높이(Height)로 표현
- 높이가 높을수록 해당 지표가 높음을 의미
- 색상 그라데이션으로 추가 정보 제공

#### 구현 방법

```jsx
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";

function HeatmapCell({ position, score }) {
  // 점수에 따라 높이와 색상 결정
  const height = score / 10; // 0-10 높이
  const color = score > 70 ? "#ff0000" : score > 40 ? "#ffff00" : "#0000ff";

  return (
    <mesh position={position}>
      <boxGeometry args={[1, height, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function SurvivalHeatmap({ bounds, gridSize = 0.01 }) {
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    // 격자 단위로 생존가능성 점수 조회
    const loadHeatmapData = async () => {
      const requests = [];
      for (let lat = bounds.minLat; lat < bounds.maxLat; lat += gridSize) {
        for (let lng = bounds.minLng; lng < bounds.maxLng; lng += gridSize) {
          requests.push(
            fetch(
              `/api/analysis/survival-score?lat=${lat}&lng=${lng}&radius=500`
            )
              .then((res) => res.json())
              .then((data) => ({
                lat,
                lng,
                score: data.survivalScore,
                position: latLngTo3D(
                  lat,
                  lng,
                  bounds.centerLat,
                  bounds.centerLng
                ),
              }))
          );
        }
      }
      const results = await Promise.all(requests);
      setHeatmapData(results);
    };

    loadHeatmapData();
  }, [bounds, gridSize]);

  return (
    <>
      {heatmapData.map((cell, index) => (
        <HeatmapCell key={index} position={cell.position} score={cell.score} />
      ))}
    </>
  );
}
```

#### 데이터 소스

- `GET /analysis/survival-score` - 히트맵 데이터 생성용
- 또는 클라이언트에서 격자 단위로 `/spatial/stores-within-radius` 호출

---

### 2. 3D 막대 그래프 (Bar Chart)

#### 개념

- 특정 위치를 클릭하면 해당 위치 주변의 분석 지표를 3D 막대 그래프로 표시
- 각 막대는 다른 지표를 나타냄 (생존가능성, 경쟁 강도, 접근성 등)

#### 구현 방법

```jsx
import { Canvas } from "@react-three/fiber";
import { Text } from "@react-three/drei";

function BarChart({ data, position }) {
  return (
    <group position={position}>
      {data.map((item, index) => (
        <group key={item.name} position={[index * 1.5, 0, 0]}>
          <mesh position={[0, item.value / 2, 0]}>
            <boxGeometry args={[0.8, item.value, 0.8]} />
            <meshStandardMaterial color={item.color} />
          </mesh>
          <Text
            position={[0, item.value + 0.5, 0]}
            fontSize={0.2}
            color="black"
            anchorX="center"
          >
            {item.name}
          </Text>
        </group>
      ))}
    </group>
  );
}

// 사용 예시: 좋은 자리 체크 결과 시각화
function LocationAnalysis({ lat, lng, sector }) {
  const [analysisData, setAnalysisData] = useState(null);

  useEffect(() => {
    fetch(`/api/analysis/good-location?lat=${lat}&lng=${lng}&sector=${sector}`)
      .then((res) => res.json())
      .then((data) => {
        setAnalysisData([
          {
            name: "생존가능성",
            value: data.survivalScore / 10,
            color: 0x00ff00,
          },
          {
            name: "경쟁 강도",
            value: data.competitionScore / 10,
            color: 0xff0000,
          },
          {
            name: "접근성",
            value: data.accessibilityScore / 10,
            color: 0x0000ff,
          },
          {
            name: "업종 적합성",
            value: data.sectorFitScore / 10,
            color: 0xffff00,
          },
        ]);
      });
  }, [lat, lng, sector]);

  if (!analysisData) return null;

  const position = latLngTo3D(lat, lng, centerLat, centerLng);
  return <BarChart data={analysisData} position={position} />;
}
```

#### 데이터 소스

- `GET /analysis/good-location?lat=...&lng=...&sector=...`

---

### 3. 점포 마커 3D 표현

#### 개념

- 각 점포를 3D 오브젝트로 표현
- 높이: 생존 기간 또는 개업일 기준
- 색상: 업종별 구분
- 크기: 점포 규모 또는 중요도

#### 구현 방법

```jsx
import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";

// 좌표 변환 함수
function latLngTo3D(lat, lng, centerLat, centerLng, scale = 1) {
  const x =
    (lng - centerLng) * scale * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const z = (lat - centerLat) * scale * 111320;
  return [x, 0, z];
}

// 점포 마커 컴포넌트
function StoreMarker({ store, position, onClick }) {
  const color = useMemo(() => {
    // 업종별 색상
    const colors = {
      일반음식점: "#ff6b6b",
      카페: "#4ecdc4",
      편의점: "#ffe66d",
    };
    return colors[store.sector] || "#95a5a6";
  }, [store.sector]);

  // 높이 계산 (생존 기간 기반)
  const height = useMemo(() => {
    if (!store.openDate) return 0.5;
    const daysSinceOpen = Math.floor(
      (Date.now() - new Date(store.openDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.min(daysSinceOpen / 365, 3); // 최대 3 단위 높이
  }, [store.openDate]);

  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, height, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 점포명 표시 (선택) */}
      {store.storeName && (
        <Text
          position={[0, height + 0.2, 0]}
          fontSize={0.1}
          color="black"
          anchorX="center"
          anchorY="middle"
        >
          {store.storeName}
        </Text>
      )}
    </group>
  );
}

// 메인 맵 컴포넌트
function StoreMap({ stores, centerLat, centerLng, onStoreClick }) {
  const storePositions = useMemo(() => {
    return stores.map((store) => {
      const location = JSON.parse(store.location);
      const [lng, lat] = location.coordinates;
      return latLngTo3D(lat, lng, centerLat, centerLng);
    });
  }, [stores, centerLat, centerLng]);

  return (
    <Canvas camera={{ position: [0, 10, 10] }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />

      {/* 바닥 평면 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>

      {/* 점포 마커들 */}
      {stores.map((store, index) => (
        <StoreMarker
          key={store.id}
          store={store}
          position={storePositions[index]}
          onClick={() => onStoreClick?.(store)}
        />
      ))}

      <OrbitControls />
    </Canvas>
  );
}
```

#### 데이터 소스

- `GET /spatial/stores-within-radius-enhanced?lat=...&lng=...&radius=...`

---

### 4. 경쟁 강도 시각화

#### 개념

- 특정 업종의 경쟁 강도를 3D로 표현
- 반경 내 동일 업종 점포 수에 따라 색상 및 높이 변화

#### 구현 방법

```jsx
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";

function CompetitionZone({ lat, lng, radius, competitionLevel }) {
  const position = latLngTo3D(lat, lng, centerLat, centerLng);
  const height = competitionLevel / 5; // 경쟁 강도에 따른 높이
  const color = useMemo(() => {
    if (competitionLevel > 20) return "#ff0000"; // 빨강: 위험
    if (competitionLevel > 10) return "#ffff00"; // 노랑: 주의
    return "#00ff00"; // 녹색: 양호
  }, [competitionLevel]);

  return (
    <group position={position}>
      {/* 원형 영역 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0, radius / 111320, 32]} />
        <meshStandardMaterial color={color} opacity={0.3} transparent />
      </mesh>
      {/* 중심 막대 */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, height, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
```

#### 데이터 소스

- `GET /analysis/competition?lat=...&lon=...&radiusMeters=...&sector=...`

---

## 🗺️ 지도 기반 구현 옵션

### 옵션 1: 평면 지도 + 3D 오버레이 (권장)

#### 구조

```
┌─────────────────────────┐
│  2D 지도 (Mapbox/Leaflet) │
│                          │
│  ┌──────────────────┐   │
│  │  3D Canvas (R3F) │   │
│  │  - 히트맵          │   │
│  │  - 막대 그래프     │   │
│  │  - 점포 마커       │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

#### 장점

- 실제 지도와 함께 표시되어 위치 파악 용이
- 기존 지도 라이브러리 활용 가능
- R3F와 지도 라이브러리 동시 사용 가능

#### 단점

- 3D 오버레이와 지도 동기화 필요
- 성능 이슈 가능성

---

### 옵션 2: 순수 3D 맵

#### 구조

```
┌─────────────────────────┐
│  3D 맵 (R3F만 사용)      │
│  - 바닥 평면             │
│  - 점포 데이터 오버레이  │
│  - 히트맵                │
└─────────────────────────┘
```

#### 장점

- 완전한 3D 경험
- 구현이 상대적으로 단순
- 성능 최적화 용이

#### 단점

- 실제 지도 배경 없음
- 위치 파악이 어려울 수 있음

---

## 🎨 UI/UX 설계

### 1. 컨트롤 패널

#### 기능

- **반경 조절**: 슬라이더로 분석 반경 조절 (100m ~ 2000m)
- **업종 필터**: 드롭다운으로 업종 선택
- **시각화 모드**: 히트맵 / 막대 그래프 / 점포 마커 전환
- **색상 테마**: 지표별 색상 설정

#### 위치

- 화면 좌측 또는 상단에 고정 패널

---

### 2. 인터랙션

#### 마우스

- **드래그**: 카메라 이동 (OrbitControls)
- **휠**: 줌 인/아웃
- **클릭**: 해당 위치 분석 결과 표시

#### 키보드

- **WASD**: 카메라 이동 (커스텀 구현)
- **Q/E**: 카메라 회전
- **R**: 리셋

---

### 3. 정보 표시

#### 툴팁

- 마우스 오버 시 해당 위치의 간단한 정보 표시
  - 좌표
  - 생존가능성 점수
  - 주변 점포 수

#### 상세 패널

- 위치 클릭 시 우측에 상세 분석 결과 표시
  - `GET /analysis/good-location` 결과
  - 위험 요소 / 기회 요소
  - 권장사항

---

## 📐 기술 구현 상세

### 1. 좌표 변환

#### 문제

- 지도 좌표 (경도/위도) → 3D 공간 좌표 변환 필요
- 지도는 구면 좌표계, 3D는 직교 좌표계

#### 해결

```javascript
// 간단한 변환 (소규모 지역)
function latLngTo3D(lat, lng, centerLat, centerLng, scale = 1) {
  const x =
    (lng - centerLng) * scale * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const z = (lat - centerLat) * scale * 111320;
  return [x, 0, z];
}
```

---

### 2. 데이터 로딩 및 업데이트

#### 전략

- **초기 로딩**: 현재 화면 영역의 데이터만 로드
- **지도 이동 시**: 새로운 영역 데이터 로드 (Lazy Loading)
- **캐싱**: 이미 로드한 영역은 캐시 활용

#### 구현

```jsx
import { useEffect, useState, useMemo } from "react";

function useGridData(bounds, gridSize = 0.01) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const loadData = async () => {
      const requests = [];
      for (let lat = bounds.minLat; lat < bounds.maxLat; lat += gridSize) {
        for (let lng = bounds.minLng; lng < bounds.maxLng; lng += gridSize) {
          requests.push(
            fetch(
              `/api/analysis/survival-score?lat=${lat}&lng=${lng}&radius=500`
            ).then((res) => res.json())
          );
        }
      }
      const results = await Promise.all(requests);
      setData(results);
      setLoading(false);
    };

    loadData();
  }, [bounds, gridSize]);

  return { data, loading };
}
```

---

### 3. R3F 주요 개념

#### Canvas 컴포넌트

- Three.js 씬의 루트 컨테이너
- 자동으로 renderer, scene, camera 생성

#### 기본 Three.js 객체를 컴포넌트로

```jsx
// Three.js: new THREE.Mesh(geometry, material)
// R3F:
<mesh>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="red" />
</mesh>
```

#### Hooks

- `useFrame`: 애니메이션 루프
- `useThree`: 씬, 카메라, renderer 접근
- `useLoader`: 리소스 로딩

---

## 🎯 성능 최적화

### 1. useMemo로 계산 최적화

```jsx
const storePositions = useMemo(() => {
  return stores.map((store) => {
    const location = JSON.parse(store.location);
    return latLngTo3D(location.coordinates[1], location.coordinates[0]);
  });
}, [stores]);
```

### 2. InstancedMesh 사용 (동일한 형태의 많은 오브젝트)

```jsx
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function StoreInstances({ stores, positions }) {
  const instancedMeshRef = useRef();

  useMemo(() => {
    if (!instancedMeshRef.current) return;

    stores.forEach((store, index) => {
      const matrix = new THREE.Matrix4();
      const [x, y, z] = positions[index];
      matrix.setPosition(x, y, z);
      instancedMeshRef.current.setMatrixAt(index, matrix);
    });
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [stores, positions]);

  return (
    <instancedMesh ref={instancedMeshRef} args={[null, null, stores.length]}>
      <cylinderGeometry args={[0.05, 0.05, 1, 16]} />
      <meshStandardMaterial color="orange" />
    </instancedMesh>
  );
}
```

### 3. Level of Detail (LOD)

```jsx
import { LOD } from "@react-three/drei";

function StoreMarkerLOD({ store, position }) {
  return (
    <LOD>
      <mesh position={position} geometry={highDetailGeometry}>
        {/* 고해상도 (가까이 있을 때) */}
      </mesh>
      <mesh position={position} geometry={mediumDetailGeometry}>
        {/* 중해상도 */}
      </mesh>
      <mesh position={position} geometry={lowDetailGeometry}>
        {/* 저해상도 (멀리 있을 때) */}
      </mesh>
    </LOD>
  );
}
```

### 4. 데이터 샘플링

```jsx
// 줌 레벨에 따라 데이터 밀도 조절
const gridSize = useMemo(() => {
  if (zoomLevel > 15) return 0.005; // 높은 줌: 세밀한 격자
  if (zoomLevel > 12) return 0.01; // 중간 줌: 보통 격자
  return 0.02; // 낮은 줌: 큰 격자
}, [zoomLevel]);
```

---

## 🔗 API 연동

### 필요한 엔드포인트

1. **점포 목록 조회**

   - `GET /spatial/stores-within-radius-enhanced`
   - 페이징, 정렬, 거리 정보 포함

2. **생존가능성 점수**

   - `GET /analysis/survival-score`
   - 히트맵 데이터 생성용

3. **좋은 자리 체크**

   - `GET /analysis/good-location`
   - 상세 분석 결과 표시용

4. **경쟁 강도**
   - `GET /analysis/competition`
   - 경쟁 강도 시각화용

---

## 🚀 구현 단계

### Phase 1: 기본 3D 씬 구성 (1주)

- [ ] React 프로젝트 설정 및 R3F 설치
- [ ] Canvas 컴포넌트 기본 설정
- [ ] 카메라 및 OrbitControls 설정
- [ ] 간단한 3D 오브젝트 렌더링 (Mesh 컴포넌트)
- [ ] 지도 좌표 → 3D 좌표 변환 유틸리티 함수 작성

### Phase 2: 데이터 시각화 (2주)

- [ ] 점포 마커 3D 표현
- [ ] 히트맵 구현
- [ ] 막대 그래프 구현
- [ ] API 연동 (axios 또는 fetch)

### Phase 3: 인터랙션 (1주)

- [ ] 마우스/키보드 컨트롤
- [ ] 클릭 이벤트 처리 (raycasting)
- [ ] 툴팁 및 정보 표시 (drei의 Html 컴포넌트)
- [ ] 애니메이션 (useFrame 활용)

### Phase 4: 최적화 및 개선 (1주)

- [ ] 성능 최적화 (LOD, Frustum Culling)
- [ ] InstancedMesh 적용
- [ ] 데이터 캐싱
- [ ] UI/UX 개선
- [ ] 반응형 디자인

---

## 📚 주요 라이브러리 및 리소스

### @react-three/drei 유틸리티

- `OrbitControls`: 카메라 컨트롤
- `Text`: 3D 텍스트
- `Html`: HTML 오버레이
- `Environment`: 환경 맵
- `Sky`: 하늘 배경
- `LOD`: Level of Detail
- `Instances`: 인스턴싱 유틸리티

### 참고 자료

#### 공식 문서

- [Three.js 공식 문서](https://threejs.org/docs/)
- [react-three-fiber 공식 문서](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
- [drei 라이브러리](https://github.com/pmndrs/drei)

#### 학습 자료

- [react-three-fiber 예제 갤러리](https://docs.pmnd.rs/react-three-fiber/getting-started/examples)
- [WebGL 기초](https://webglfundamentals.org/)
- [Three.js Journey](https://threejs-journey.com/) - 유료 강의

---

## 🎯 예상 결과물

### 화면 구성 예시

```
┌─────────────────────────────────────────────┐
│ [반경: 500m] [업종: 전체] [모드: 히트맵]     │
├─────────────────────────────────────────────┤
│                                             │
│        3D 히트맵 (점포 밀도)                │
│        ┌─────┐                              │
│        │  ▲  │  ← 높은 밀도                │
│        └─────┘                              │
│                                             │
│        ┌─────┐                              │
│        │  ▼  │  ← 낮은 밀도                │
│        └─────┘                              │
│                                             │
│  [클릭 시 우측에 상세 정보 표시]            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## ⚠️ 주의사항

1. **성능**: 대량의 데이터 렌더링 시 성능 이슈 발생 가능

   - 해결: InstancedMesh, LOD, 데이터 샘플링 활용

2. **브라우저 호환성**: WebGL 지원 브라우저 필요

   - 해결: WebGL 지원 여부 체크 및 폴백 제공

3. **데이터 양**: 실시간으로 많은 API 호출 시 서버 부하 고려

   - 해결: 클라이언트 캐싱, 배치 요청, 디바운싱

4. **사용자 경험**: 3D 인터랙션 학습 곡선 고려

   - 해결: 직관적인 컨트롤, 튜토리얼 제공

5. **메모리 관리**: 컴포넌트 언마운트 시 자동으로 정리되지만, 커스텀 리소스는 수동 정리 필요

---

## 📝 완전한 예제 코드

### 통합 상권 분석 맵 컴포넌트

```jsx
import { useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";

// 좌표 변환
function latLngTo3D(lat, lng, centerLat, centerLng, scale = 1) {
  const x =
    (lng - centerLng) * scale * 111320 * Math.cos((centerLat * Math.PI) / 180);
  const z = (lat - centerLat) * scale * 111320;
  return [x, 0, z];
}

// 점포 마커
function StoreMarker({ store, position, onClick }) {
  const color = useMemo(() => {
    const colors = {
      일반음식점: "#ff6b6b",
      카페: "#4ecdc4",
      편의점: "#ffe66d",
    };
    return colors[store.sector] || "#95a5a6";
  }, [store.sector]);

  const height = useMemo(() => {
    if (!store.openDate) return 0.5;
    const daysSinceOpen = Math.floor(
      (Date.now() - new Date(store.openDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.min(daysSinceOpen / 365, 3);
  }, [store.openDate]);

  return (
    <group position={position} onClick={onClick}>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, height, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// 메인 맵 컴포넌트
function CommercialDistrictMap() {
  const [stores, setStores] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const centerLat = 37.5665;
  const centerLng = 126.978;

  useEffect(() => {
    fetch(
      `/api/spatial/stores-within-radius-enhanced?lat=${centerLat}&lng=${centerLng}&radius=1000`
    )
      .then((res) => res.json())
      .then((data) => setStores(data.stores));
  }, []);

  const storePositions = useMemo(() => {
    return stores.map((store) => {
      const location = JSON.parse(store.location);
      const [lng, lat] = location.coordinates;
      return latLngTo3D(lat, lng, centerLat, centerLng);
    });
  }, [stores]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 10, 10] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />

        {/* 바닥 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>

        {/* 점포 마커들 */}
        {stores.map((store, index) => (
          <StoreMarker
            key={store.id}
            store={store}
            position={storePositions[index]}
            onClick={() => setSelectedLocation(store)}
          />
        ))}

        <OrbitControls />
      </Canvas>

      {/* 상세 정보 패널 */}
      {selectedLocation && (
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 20,
            background: "white",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h3>{selectedLocation.storeName}</h3>
          <p>업종: {selectedLocation.sector}</p>
          <p>주소: {selectedLocation.address}</p>
        </div>
      )}
    </div>
  );
}

export default CommercialDistrictMap;
```

---

**다음 단계**: Phase 1부터 시작하여 단계적으로 구현 진행
