import { sql } from '../db';
import type { Status } from '../types';
import { unstable_cache } from './shared';

// ============ CACHING HELPERS ============

const getCachedStatuses = unstable_cache(
  async (): Promise<Status[]> => {
    const rows = await sql`SELECT * FROM statuses`;
    return rows as unknown as Status[];
  },
  ['statuses-all'],
  { tags: ['statuses'] }
);

const getCachedStatusById = unstable_cache(
  async (id: string): Promise<Status | null> => {
    const rows = await sql`SELECT * FROM statuses WHERE id = ${id} LIMIT 1`;
    return (rows[0] as unknown as Status) || null;
  },
  ['status-by-id'],
  { tags: ['statuses'] }
);

// ============ STATUS REPOSITORY ============

export const StatusRepository = {
  async findAll(): Promise<Status[]> {
    return getCachedStatuses();
  },

  async findById(id: string): Promise<Status | null> {
    return getCachedStatusById(id);
  },
};
