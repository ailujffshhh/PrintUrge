CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (id, name) VALUES
  (1, 'admin'),
  (2, 'staff'),
  (3, 'client')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval('roles_id_seq', GREATEST((SELECT MAX(id) FROM roles), 3), true);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL DEFAULT 3 REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  archived_at TIMESTAMPTZ NULL,
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_archived_at ON users(archived_at);

CREATE TABLE IF NOT EXISTS print_requests (
  id BIGSERIAL PRIMARY KEY,
  transaction_id VARCHAR(40) NULL UNIQUE,
  user_id BIGINT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  customer_name VARCHAR(160) NULL,
  customer_notes TEXT NULL,
  payment_method VARCHAR(80) NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
  service VARCHAR(64) NOT NULL,
  color_mode VARCHAR(64) NULL,
  size_key VARCHAR(64) NULL,
  copies INT NOT NULL DEFAULT 1 CHECK (copies > 0),
  pages INT NOT NULL DEFAULT 1 CHECK (pages > 0),
  custom_width VARCHAR(32) NULL,
  custom_height VARCHAR(32) NULL,
  files_json JSONB NOT NULL,
  admin_notes TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_print_requests_user_id ON print_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_print_requests_status ON print_requests(status);
CREATE INDEX IF NOT EXISTS idx_print_requests_payment_status ON print_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_print_requests_created_at ON print_requests(created_at);

CREATE TABLE IF NOT EXISTS print_request_files (
  id BIGSERIAL PRIMARY KEY,
  print_request_id BIGINT NOT NULL REFERENCES print_requests(id) ON DELETE CASCADE,
  stored_name VARCHAR(80) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(160) NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_print_request_files_request_id ON print_request_files(print_request_id);
CREATE INDEX IF NOT EXISTS idx_print_request_files_stored_name ON print_request_files(stored_name);
