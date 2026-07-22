import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || '';

const globalForDb = globalThis as unknown as {
  sql: postgres.Sql | undefined;
};

export const sql = globalForDb.sql || postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  prepare: false // Required for Supabase Transaction Pooler (pgbouncer)
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.sql = sql;
}

