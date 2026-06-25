import { sql } from '../db';

export interface RoleLevel {
  role_name: string;
  level: number;
}

export const RoleLevelRepository = {
  async findAll(): Promise<RoleLevel[]> {
    const rows = await sql`SELECT * FROM role_levels ORDER BY level DESC, role_name ASC`;
    return rows as unknown as RoleLevel[];
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
    return rows[0] as unknown as RoleLevel;
  },

  async delete(roleName: string): Promise<boolean> {
    const norm = roleName.toLowerCase().replace(/\s+/g, "");
    if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) return false;
    await sql`DELETE FROM role_levels WHERE LOWER(role_name) = LOWER(${roleName})`;
    return true;
  }
};
