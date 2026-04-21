-- =====================================================
--   Case File Migration — HYDRAA
--   Adds accused details, case file, police stations,
--   document vault, and petition/notice tracking
-- =====================================================

-- USE hydraa; -- handled by connection config on Railway

-- ── Accused persons (optional citizen entry + official confirmation)
CREATE TABLE IF NOT EXISTS accused_persons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(15),
  email VARCHAR(100),
  address TEXT,
  aadhaar_no VARCHAR(20),
  relation VARCHAR(100),
  occupation VARCHAR(100),
  added_by ENUM('citizen','official','admin') DEFAULT 'official',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint (complaint_id)
);

-- ── Site visit reports (official fills after field visit)
CREATE TABLE IF NOT EXISTS site_visit_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  official_id INT NOT NULL,
  visit_date DATE NOT NULL,
  visit_time TIME,
  encroachment_area VARCHAR(100),
  construction_type VARCHAR(200),
  current_status TEXT,
  findings TEXT,
  geo_lat DECIMAL(10,7),
  geo_lng DECIMAL(10,7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (official_id) REFERENCES officials(id),
  UNIQUE KEY one_report_per_complaint (complaint_id),
  INDEX idx_complaint (complaint_id)
);

-- ── Case file document vault (replaces/extends 5-photo limit)
CREATE TABLE IF NOT EXISTS complaint_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  doc_type ENUM('Survey Map','Ownership Proof','Encroachment Photo','Legal Document','Site Visit Photo','Notice Copy','Other') DEFAULT 'Other',
  file_name VARCHAR(255) NOT NULL,
  file_data LONGTEXT NOT NULL,
  file_mime VARCHAR(100),
  caption TEXT,
  uploaded_by_id INT,
  uploaded_by_role ENUM('official','admin') DEFAULT 'official',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint (complaint_id)
);

-- ── Case file admin ↔ official internal notes thread
CREATE TABLE IF NOT EXISTS case_file_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  author_id INT NOT NULL,
  author_role ENUM('admin','official') NOT NULL,
  author_name VARCHAR(100),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  INDEX idx_complaint (complaint_id)
);

-- ── Police station directory (admin manages, officials can view)
CREATE TABLE IF NOT EXISTS police_stations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  district_id INT,
  mandal_id INT,
  address TEXT,
  phone VARCHAR(15),
  email VARCHAR(100),
  officer_in_charge VARCHAR(100),
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL,
  FOREIGN KEY (mandal_id) REFERENCES mandals(id) ON DELETE SET NULL,
  INDEX idx_district (district_id),
  INDEX idx_mandal (mandal_id)
);

-- ── Petition & notice tracking
CREATE TABLE IF NOT EXISTS petition_notices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  complaint_id INT NOT NULL,
  doc_type ENUM('petition','notice') NOT NULL,
  generated_by_id INT,
  generated_by_role ENUM('admin','official') DEFAULT 'official',
  sent_to_name VARCHAR(200),
  sent_to_email VARCHAR(100),
  sent_to_type ENUM('police_station','accused','admin','revenue','collector','other') DEFAULT 'other',
  police_station_id INT,
  send_status ENUM('generated','sent','failed') DEFAULT 'generated',
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
  FOREIGN KEY (police_station_id) REFERENCES police_stations(id) ON DELETE SET NULL,
  INDEX idx_complaint (complaint_id)
);
