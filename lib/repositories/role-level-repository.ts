import { sql } from '../db';
import { redis } from '../redis';

const CACHE_KEY = 'role_levels_all';

export interface RoleLevel {
  role_name: string;
  level: number;
}

export const RoleLevelRepository = {
  async findAll(): Promise<RoleLevel[]> {
    if (redis) {
      const cached = await redis.get<RoleLevel[]>(CACHE_KEY);
      if (cached) return cached;
    }
    const rows = await sql`SELECT * FROM role_levels ORDER BY level DESC, role_name ASC`;
    const result = rows as unknown as RoleLevel[];
    if (redis) {
      await redis.set(CACHE_KEY, result, { ex: 3600 }); // 1 hour cache
    }
    return result;
  },

  async findByRole(roleName: string): Promise<RoleLevel | null> {
    const rows = await sql`SELECT * FROM role_levels WHERE LOWER(role_name) = LOWER(${roleName}) LIMIT 1`;
    if (rows.length === 0) return null;
    return rows[0] as unknown as RoleLevel;
  },

  async upsert(roleName: string, level: number): Promise<RoleLevel> {
    const norm = roleName.toLowerCase().replace(/\s+/g, "");
    if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) {
      const existing = await this.findByRole(roleName);
      if (existing) return existing;
    }
    const rows = await sql`
      INSERT INTO role_levels (role_name, level) 
      VALUES (${roleName}, ${level}) 
      ON CONFLICT (role_name) 
      DO UPDATE SET level = ${level}
      RETURNING *
    `;
    if (redis) await redis.del(CACHE_KEY);
    return rows[0] as unknown as RoleLevel;
  },

  async delete(roleName: string): Promise<boolean> {
    const norm = roleName.toLowerCase().replace(/\s+/g, "");
    if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) return false;
    await sql`DELETE FROM role_levels WHERE LOWER(role_name) = LOWER(${roleName})`;
    if (redis) await redis.del(CACHE_KEY);
    return true;
  }
};
