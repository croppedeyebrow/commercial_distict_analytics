import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'password',
  database: process.env.POSTGRES_DB ?? 'district_analytics_local_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  // synchronize 설정 전략:
  // 1. 현재 false: 백엔드 설계 안정화 단계 (스키마 동기화 비활성화)
  // 2. geocode_script.py 실행: address가 있는 모든 레코드의 location 컬럼을 채움
  // 3. SQL 스크립트 실행: 필수 컬럼(sector, openDate, location)이 null인 레코드 삭제
  // 4. true로 변경: 데이터 정리 완료 후 스키마 동기화 활성화
  synchronize: false, // 지오코딩 및 데이터 정리 완료 후 true로 변경
  logging: (process.env.NODE_ENV ?? 'development') === 'development',
  autoLoadEntities: true,
});
