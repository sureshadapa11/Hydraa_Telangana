-- =====================================================
--   Database Schema — HYDRAA
--   MySQL database structure for HYDRAA system
-- =====================================================

CREATE DATABASE IF NOT EXISTS hydraa;
USE hydraa;

-- ── Users Table ──
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15),
  address VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT 0,
  verification_token VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Admins Table ──
CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  is_active BOOLEAN DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Officials Table ──
CREATE TABLE IF NOT EXISTS officials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15),
  department VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Categories Table ──
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Subcategories Table ──
CREATE TABLE IF NOT EXISTS subcategories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE KEY unique_subcat (category_id, name)
);

-- ── States Table ──
CREATE TABLE IF NOT EXISTS states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state_name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10)
);

-- ── Complaints Table ──
CREATE TABLE IF NOT EXISTS complaints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_no VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category_id INT,
  subcategory_id INT,
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  state_id INT,
  address TEXT NOT NULL,
  status ENUM('open', 'assigned', 'in_progress', 'resolved', 'rejected', 'closed') DEFAULT 'open',
  official_id INT,
  admin_remarks TEXT,
  official_remarks TEXT,
  attachment VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id),
  FOREIGN KEY (state_id) REFERENCES states(id),
  FOREIGN KEY (official_id) REFERENCES officials(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_official (official_id)
);

-- ── Complaint History Table ──
CREATE TABLE IF NOT EXISTS complaint_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by_id INT,
  changed_by_role ENUM('user', 'admin', 'official') DEFAULT 'admin',
  remarks TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint (complaint_id)
);

-- ── Complaint Ratings Table ──
CREATE TABLE IF NOT EXISTS complaint_ratings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  user_id INT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rating (complaint_id, user_id),
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── User Logs Table ──
CREATE TABLE IF NOT EXISTS user_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(100),
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);

-- ── Indexes ──
CREATE INDEX idx_complaint_no ON complaints(complaint_no);
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_official_email ON officials(email);

-- ── Insert Sample Data ──
INSERT INTO states (state_name, code) VALUES
('Telangana', 'TG'),
('Andhra Pradesh', 'AP'),
('Maharashtra', 'MH'),
('Karnataka', 'KA'),
('Tamil Nadu', 'TN');

INSERT INTO categories (name, description) VALUES
('Lake / Water Body Encroachment', 'Illegal construction within FTL or 30m buffer zones around lakes and nalas'),
('Illegal Construction', 'Unauthorized buildings violating GHMC or town planning regulations'),
('Park / Open Space Violation', 'Encroachment on designated parks, playgrounds, or open layout spaces'),
('Road / Footpath Obstruction', 'Blocking of carriageways, footpaths, or public roads by unauthorized structures'),
('Flooding & Drainage Issue', 'Blocked drains, waterlogging, or flood-risk due to encroachment'),
('Government Land Encroachment', 'Unauthorized occupation of government-owned land parcels in Hyderabad'),
('Illegal Advertisements', 'Unauthorized hoardings, banners, or flex boards on public property'),
('Disaster / Emergency', 'Fire, collapse, or flood emergency requiring immediate HYDRAA response');
