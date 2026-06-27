import { sql } from '../db';
import type { User, UserLog } from '../types';
import { unstable_cache, revalidateTag } from './shared';
import { RoleLevelRepository } from './role-level-repository';
import { redis } from '../redis';

// ============ CACHING HELPERS ============

const CACHE_KEY_USERS = 'users_all';
const CACHE_KEY_USERS_DEL = 'users_all_del';

const getCachedUsers = unstable_cache(
  async (): Promise<User[]> => {
    if (redis) {
      const cached = await redis.get<User[]>(CACHE_KEY_USERS);
      if (cached) return cached;
    }
    const rows = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
    const res = rows as unknown as User[];
    if (redis) await redis.set(CACHE_KEY_USERS, res, { ex: 300 });
    return res;
  },
  ['users-all'],
  { tags: ['users'], revalidate: 60 }
);

const getCachedUsersIncludingDeleted = unstable_cache(
  async (): Promise<User[]> => {
    if (redis) {
      const cached = await redis.get<User[]>(CACHE_KEY_USERS_DEL);
      if (cached) return cached;
    }
    const rows = await sql`SELECT * FROM users`;
    const res = rows as unknown as User[];
    if (redis) await redis.set(CACHE_KEY_USERS_DEL, res, { ex: 300 });
    return res;
  },
  ['users-all-including-deleted'],
  { tags: ['users'], revalidate: 60 }
);

const getCachedUserByEmail = unstable_cache(
  async (email: string): Promise<User | null> => {
    const rows = await sql`SELECT * FROM users WHERE LOWER(user_email) = LOWER(${email}) AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as User) || null;
  },
  ['user-by-email'],
  { tags: ['users'], revalidate: 60 }
);

const getCachedUserById = unstable_cache(
  async (userId: string): Promise<User | null> => {
    const rows = await sql`SELECT * FROM users WHERE user_id = ${userId} AND deleted_at IS NULL LIMIT 1`;
    return (rows[0] as unknown as User) || null;
  },
  ['user-by-id'],
  { tags: ['users'], revalidate: 60 }
);

// ============ USER REPOSITORY ============

export const UserRepository = {
  async findAll(): Promise<User[]> {
    const users = await getCachedUsers();
    const roles = await RoleLevelRepository.findAll();
    const roleLevelMap = new Map<string, number>();
    for (const r of roles) {
      roleLevelMap.set(r.role_name.toLowerCase(), r.level);
    }
    return users.map((u) => {
      let level = 1;
      if (u.user_occupation) {
        const norm = u.user_occupation.toLowerCase().replace(/\s+/g, "");
        if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) {
          level = 7;
        } else {
          level = roleLevelMap.get(u.user_occupation.toLowerCase()) || 1;
        }
      }
      return {
        ...u,
        level,
      };
    });
  },

  async findAllIncludingDeleted(): Promise<User[]> {
    const users = await getCachedUsersIncludingDeleted();
    const roles = await RoleLevelRepository.findAll();
    const roleLevelMap = new Map<string, number>();
    for (const r of roles) {
      roleLevelMap.set(r.role_name.toLowerCase(), r.level);
    }
    return users.map((u) => {
      let level = 1;
      if (u.user_occupation) {
        const norm = u.user_occupation.toLowerCase().replace(/\s+/g, "");
        if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) {
          level = 7;
        } else {
          level = roleLevelMap.get(u.user_occupation.toLowerCase()) || 1;
        }
      }
      return {
        ...u,
        level,
      };
    });
  },

  async findByEmail(email: string): Promise<User | null> {
    return getCachedUserByEmail(email);
  },

  async findById(userId: string): Promise<User | null> {
    return getCachedUserById(userId);
  },

  async create(
    user: {
      user_email: string;
      user_name: string | null;
      user_occupation: string | null;
      user_division: string | null;
      user_departement: string | null;
      user_site?: string | null;
      user_team?: string | null;
      user_unit?: string | null;
    },
    createdBy: string
  ): Promise<User> {
    const lastRow = await sql`SELECT user_id FROM users ORDER BY user_id DESC LIMIT 1`;
    const lastId = lastRow[0]?.user_id || 'U-0000';
    const lastNum = parseInt(lastId.replace('U-', ''), 10) || 0;
    const nextId = 'U-' + String(lastNum + 1).padStart(4, '0');
    const now = new Date().toISOString();

    const newUser: User = {
      user_id: nextId,
      user_email: user.user_email,
      user_name: user.user_name,
      user_occupation: user.user_occupation,
      user_division: user.user_division,
      user_departement: user.user_departement,
      user_site: user.user_site || null,
      user_team: user.user_team || null,
      user_unit: user.user_unit || null,
      created_by: createdBy,
      created_at: now,
      updated_by: null,
      updated_at: null,
      deleted_by: null,
      deleted_at: null,
    };

    await sql`
      INSERT INTO users (
        user_id, user_email, user_name, user_occupation, user_division, user_departement,
        user_site, user_team, user_unit,
        created_by, created_at, updated_by, updated_at, deleted_by, deleted_at
      ) VALUES (
        ${newUser.user_id}, ${newUser.user_email}, ${newUser.user_name}, ${newUser.user_occupation},
        ${newUser.user_division}, ${newUser.user_departement}, ${newUser.user_site}, ${newUser.user_team}, ${newUser.user_unit},
        ${newUser.created_by}, ${newUser.created_at},
        ${newUser.updated_by}, ${newUser.updated_at}, ${newUser.deleted_by}, ${newUser.deleted_at}
      ) RETURNING *
    `;

    if (redis) {
      await redis.del(CACHE_KEY_USERS);
      await redis.del(CACHE_KEY_USERS_DEL);
    }
    revalidateTag('users');
    return newUser;
  },

  async updateUser(
    userId: string,
    data: {
      user_name: string | null;
      user_email?: string;
      user_occupation: string | null;
      user_departement: string | null;
      user_division: string | null;
      user_site: string | null;
      user_team: string | null;
      user_unit: string | null;
      deleted_at?: string | null;
      deleted_by?: string | null;
    },
    updatedBy: string
  ): Promise<boolean> {
    const hasDeletedAt = 'deleted_at' in data;
    if (hasDeletedAt) {
      await sql`
        UPDATE users 
        SET user_name = ${data.user_name},
            user_email = ${data.user_email !== undefined ? data.user_email : sql`user_email`},
            user_occupation = ${data.user_occupation},
            user_departement = ${data.user_departement},
            user_division = ${data.user_division},
            user_site = ${data.user_site},
            user_team = ${data.user_team},
            user_unit = ${data.user_unit},
            deleted_at = ${data.deleted_at as string | null},
            deleted_by = ${data.deleted_by as string | null},
            updated_at = ${new Date().toISOString()}, 
            updated_by = ${updatedBy} 
        WHERE user_id = ${userId}
        RETURNING *
      `;
    } else {
      await sql`
        UPDATE users 
        SET user_name = ${data.user_name},
            user_email = ${data.user_email !== undefined ? data.user_email : sql`user_email`},
            user_occupation = ${data.user_occupation},
            user_departement = ${data.user_departement},
            user_division = ${data.user_division},
            user_site = ${data.user_site},
            user_team = ${data.user_team},
            user_unit = ${data.user_unit},
            updated_at = ${new Date().toISOString()}, 
            updated_by = ${updatedBy} 
        WHERE user_id = ${userId}
        RETURNING *
      `;
    }
    if (redis) {
      await redis.del(CACHE_KEY_USERS);
      await redis.del(CACHE_KEY_USERS_DEL);
    }
    revalidateTag('users');
    return true;
  },
};

// ============ USER LEVEL HELPER ============

export async function getUserLevel(userOccupation: string | null): Promise<number> {
  if (!userOccupation) return 1; // Default to Staff (Level 1)
  const norm = userOccupation.toLowerCase().replace(/\s+/g, "");
  if (['superuser', 'cosuperuser', 'co-superuser'].includes(norm)) return 7; // Lock Admin to Level 7

  const role = await RoleLevelRepository.findByRole(userOccupation);
  return role ? role.level : 1; // Default to Level 1 if not mapped
}

// ============ USER LOOKUP ============

const getCachedUserMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const users = await UserRepository.findAll();
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.user_id] = u.user_name || u.user_email || u.user_id;
    }
    return map;
  },
  ['user-map'],
  { tags: ['users'], revalidate: 60 }
);

export async function getUserMap(): Promise<Record<string, string>> {
  return getCachedUserMap();
}

export async function resolveUserName(userId: string | null | undefined): Promise<string> {
  if (!userId) return '—';
  const map = await getUserMap();
  return map[userId] ?? userId;
}

export async function resolveUserNames(userIds: (string | null | undefined)[]): Promise<string> {
  const valid = userIds.filter((id): id is string => !!id);
  if (valid.length === 0) return '—';
  const map = await getUserMap();
  return valid.map((id) => map[id] ?? id).join(', ');
}

export function invalidateUserMap() {
  revalidateTag('users');
}

// ============ USER LOG REPOSITORY ============

export const UserLogRepository = {
  async create(
    log: {
      user_id: string;
      action: string;
      details: string | null;
    },
    createdBy: string
  ): Promise<UserLog> {
    const res = await sql`SELECT COUNT(*)::int as count FROM user_logs`;
    const nextId = 'ul-' + String((res[0].count || 0) + 1).padStart(3, '0') + '-' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    const newLog: UserLog = {
      id: nextId,
      user_id: log.user_id,
      action: log.action,
      details: log.details,
      created_by: createdBy,
      created_at: now,
    };

    await sql`
      INSERT INTO user_logs (
        id, user_id, action, details, created_by, created_at
      ) VALUES (
        ${newLog.id}, ${newLog.user_id}, ${newLog.action}, ${newLog.details},
        ${newLog.created_by}, ${newLog.created_at}
      )
    `;

    return newLog;
  },

  async findByUserId(userId: string): Promise<UserLog[]> {
    const rows = await sql`
      SELECT ul.*, u.user_name as actor_name, u.user_email as actor_email
      FROM user_logs ul
      LEFT JOIN users u ON ul.created_by = u.user_id
      WHERE ul.user_id = ${userId}
      ORDER BY ul.created_at DESC
    `;
    return rows as any[];
  },

  async findAll(): Promise<UserLog[]> {
    const rows = await sql`
      SELECT ul.*, 
             u_target.user_name as target_name, u_target.user_email as target_email,
             u_actor.user_name as actor_name, u_actor.user_email as actor_email
      FROM user_logs ul
      LEFT JOIN users u_target ON ul.user_id = u_target.user_id
      LEFT JOIN users u_actor ON ul.created_by = u_actor.user_id
      ORDER BY ul.created_at DESC
      LIMIT 200
    `;
    return rows as any[];
  }
};
