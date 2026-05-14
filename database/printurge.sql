SET NAMES utf8mb4;
SET time_zone = "+00:00";

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (id, name) VALUES
  (1, 'admin'),
  (2, 'staff'),
  (3, 'client');

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL DEFAULT 3,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  account_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  member_since TIMESTAMP NULL DEFAULT NULL,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_id (role_id),
  KEY idx_users_archived_at (archived_at),
  CONSTRAINT fk_users_role_id
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE print_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  service VARCHAR(64) NOT NULL,
  color_mode VARCHAR(64) NULL DEFAULT NULL,
  size_key VARCHAR(64) NULL DEFAULT NULL,
  copies INT UNSIGNED NOT NULL DEFAULT 1,
  pages INT UNSIGNED NOT NULL DEFAULT 1,
  custom_width VARCHAR(32) NULL DEFAULT NULL,
  custom_height VARCHAR(32) NULL DEFAULT NULL,
  files_json JSON NOT NULL,
  admin_notes TEXT NULL,
  subtotal_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  credits_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_priority TINYINT(1) NOT NULL DEFAULT 0,
  pickup_slot_id BIGINT UNSIGNED NULL DEFAULT NULL,
  preset_id BIGINT UNSIGNED NULL DEFAULT NULL,
  status ENUM('active','archived') NOT NULL DEFAULT 'active',
  archived_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_print_requests_user_id (user_id),
  KEY idx_print_requests_status (status),
  KEY idx_print_requests_completed_at (completed_at),
  KEY idx_print_requests_created_at (created_at),
  CONSTRAINT fk_print_requests_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'manual',
  provider_customer_id VARCHAR(160) NULL,
  provider_subscription_id VARCHAR(160) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'incomplete',
  plan_key VARCHAR(80) NOT NULL DEFAULT 'printurge_member',
  current_period_start TIMESTAMP NULL DEFAULT NULL,
  current_period_end TIMESTAMP NULL DEFAULT NULL,
  cancel_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_subscriptions_user_id (user_id),
  KEY idx_subscriptions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE print_presets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  service VARCHAR(64) NOT NULL,
  color_mode VARCHAR(64) NULL,
  size_key VARCHAR(64) NULL,
  copies INT UNSIGNED NOT NULL DEFAULT 1,
  pages INT UNSIGNED NOT NULL DEFAULT 1,
  custom_width VARCHAR(32) NULL,
  custom_height VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_print_presets_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE member_credits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  period_month VARCHAR(7) NOT NULL,
  starting_credits DECIMAL(10,2) NOT NULL DEFAULT 0,
  used_credits DECIMAL(10,2) NOT NULL DEFAULT 0,
  remaining_credits DECIMAL(10,2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_member_credits_period (user_id, period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE member_benefits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  benefit_key VARCHAR(80) NOT NULL,
  period_month VARCHAR(7) NOT NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  limit_count INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_member_benefits_period (user_id, benefit_key, period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pickup_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  print_request_id BIGINT UNSIGNED NULL DEFAULT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  pickup_date DATE NOT NULL,
  time_window VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'booked',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pickup_slots_user_id (user_id),
  KEY idx_pickup_slots_request_id (print_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
