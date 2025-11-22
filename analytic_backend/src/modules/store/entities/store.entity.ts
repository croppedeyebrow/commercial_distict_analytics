import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 점포(Store) 엔티티
 *
 * 상권 분석에 필요한 점포 데이터를 저장하는 테이블과 매핑됩니다.
 * PostgreSQL의 'store' 테이블과 연결되며, PostGIS를 사용한 공간 데이터를 포함합니다.
 */
@Entity({ name: 'store' })
// 업종별 필터링 성능 향상을 위한 인덱스
@Index('idx_sector', ['sector'])
// 폐업 점포 조회 성능 향상을 위한 인덱스
@Index('idx_close_date', ['closeDate'])
export class StoreEntity {
  /** 점포 고유 식별자 (자동 증가 정수) */
  @PrimaryGeneratedColumn()
  id: number;

  /** 점포명 (예: "스타벅스 강남점") */
  @Column({ name: 'storeName', length: 255, nullable: true })
  storeName: string;

  /** 업종 분류 코드 (예: "C10" = 카페, 필수값) */
  @Column({ name: 'sector', length: 50, nullable: false })
  sector: string;

  /** 점포 주소 (선택값) */
  @Column({ name: 'address', length: 500, nullable: true })
  address?: string;

  /** 영업 시작일 (필수값) */
  @Column({ name: 'openDate', type: 'date', nullable: false })
  openDate: Date;

  /** 영업 종료일 (폐업한 경우에만 값이 있음, NULL이면 영업 중) */
  @Column({ name: 'closeDate', type: 'date', nullable: true })
  closeDate?: Date;

  /**
   * 점포 위치 (PostGIS 공간 데이터)
   *
   * - 타입: Point (점 좌표)
   * - 좌표계: WGS84 (SRID 4326) - 경도/위도 형식
   * - 필수값: 모든 점포는 위치 정보를 가져야 함
   * - 인덱스: GIST 인덱스로 공간 검색 성능 최적화 (반경 검색 등)
   */
  @Column({
    name: 'location',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: false,
  })
  @Index('idx_location_gist', { spatial: true })
  location: string;
}
