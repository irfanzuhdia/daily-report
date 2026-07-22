-- Ensure user_unit column exists in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_unit VARCHAR(255) DEFAULT NULL;

-- Create role_levels table
CREATE TABLE IF NOT EXISTS role_levels (
    role_name VARCHAR(100) PRIMARY KEY,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 7)
);

-- Create user_logs table
CREATE TABLE IF NOT EXISTS user_logs (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_by VARCHAR(100) NOT NULL,
    created_at VARCHAR(100) NOT NULL
);

-- Seed default values for role_levels
INSERT INTO role_levels (role_name, level) VALUES
    ('Direktur', 6),
    ('Site Manager', 5),
    ('Site Admin', 5),
    ('Div Manager', 4),
    ('Div Admin', 4),
    ('Supervisor', 3),
    ('Team Leader', 2),
    ('Staff', 1)
ON CONFLICT (role_name) DO NOTHING;
