-- ============================================
-- Database schema - Task API
-- Run this file before starting the API
-- It can run more than once without errors.
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,         -- stores the bcrypt hash
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table
-- Each task belongs to a user (foreign key)
CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  completed   BOOLEAN DEFAULT FALSE,
  priority    VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Index to speed up lookups by user
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

-- Function that updates updated_at automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger that calls the function above before any UPDATE on tasks
-- (DROP before CREATE so the script can run again)
DROP TRIGGER IF EXISTS trigger_update_tasks ON tasks;
CREATE TRIGGER trigger_update_tasks
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
