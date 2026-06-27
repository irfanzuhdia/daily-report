import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL || '';

export const sql = postgres(databaseUrl, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20
});

// Self-initializing DB schema for role_levels
if (databaseUrl && typeof window === 'undefined') {
  (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS role_levels (
          role_name VARCHAR(100) PRIMARY KEY,
          level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 7)
        )
      `;
      // Ensure user_unit column exists in users table on startup
      await sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS user_unit VARCHAR(255) DEFAULT NULL
      `;
      // Ensure user_logs table exists on startup
      await sql`
        CREATE TABLE IF NOT EXISTS user_logs (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          created_by VARCHAR(100) NOT NULL,
          created_at VARCHAR(100) NOT NULL
        )
      `;
      // Seed default values
      await sql`
        INSERT INTO role_levels (role_name, level) VALUES
          ('Direktur', 6),
          ('Site Manager', 5),
          ('Site Admin', 5),
          ('Div Manager', 4),
          ('Div Admin', 4),
          ('Supervisor', 3),
          ('Team Leader', 2),
          ('Staff', 1)
        ON CONFLICT (role_name) DO NOTHING
      `;
      console.log('role_levels table initialized successfully.');
    } catch (e) {
      console.error('Failed to initialize role_levels table:', e);
    }
  })();
}
