import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface StoreWithinRadiusRow {
  id: string;
  storeName: string;
  sector: string | null;
  address: string | null;
  location: string;
}

@Injectable()
export class SpatialService {
  constructor(private readonly dataSource: DataSource) {}

  async findStoresWithinRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Promise<StoreWithinRadiusRow[]> {
    const query = `
      SELECT
        id,
        "storeName",
        "sector",
        "address",
        ST_AsGeoJSON(location) AS location
      FROM store
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      ORDER BY "openDate" DESC
      LIMIT 100;
    `;

    const rows: unknown[] = await this.dataSource.query(query, [
      lng,
      lat,
      radiusMeters,
    ]);

    const toOptionalString = (value: unknown): string | null => {
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'number') {
        return value.toString();
      }
      return null;
    };

    return (Array.isArray(rows) ? rows : []).map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        id: toOptionalString(row.id ?? row['ID']) ?? '',
        storeName: toOptionalString(row.storeName ?? row['store_name']) ?? '',
        sector: toOptionalString(row.sector),
        address: toOptionalString(row.address),
        location:
          toOptionalString(
            row.location ?? row['st_asgeojson'] ?? row['location_geojson'],
          ) ?? '',
      };
    });
  }
}
