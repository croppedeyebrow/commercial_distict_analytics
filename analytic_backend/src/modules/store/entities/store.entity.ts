import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'store' })
export class StoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  @Index('idx_store_name')
  storeName: string;

  @Column({ length: 255, nullable: true })
  sector?: string;

  @Column({ length: 500, nullable: true })
  address?: string;

  @Column({ type: 'date', nullable: true })
  openDate?: Date;

  @Column({ type: 'date', nullable: true })
  closeDate?: Date;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  @Index({ spatial: true })
  location?: string;
}
