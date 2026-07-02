-- =====================================================
--   HYDRAA Database Schema Updates
--   Add OTP throttling table + MIME type column
-- =====================================================

-- ✅ ADD: OTP Requests Table (replaces in-memory store)
CREATE TABLE IF NOT EXISTS otp_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  role ENUM('user', 'admin', 'official') DEFAULT 'user',
  user_name VARCHAR(100),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_expires (expires_at)
);

-- ✅ UPDATE: Add MIME type column to complaint_photos for secure rendering
ALTER TABLE complaint_photos 
ADD COLUMN mime_type VARCHAR(50) DEFAULT 'image/jpeg' AFTER photo_data;

-- ✅ UPDATE: Add missing foreign key constraints with ON DELETE SET NULL
ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_official 
FOREIGN KEY (official_id) REFERENCES officials(id) ON DELETE SET NULL;

ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_category 
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_subcategory 
FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL;

ALTER TABLE complaints 
ADD CONSTRAINT fk_complaints_state 
FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL;

-- ✅ UPDATE: Add indexes for better query performance
CREATE INDEX idx_complaint_status ON complaints(status);
CREATE INDEX idx_complaint_created ON complaints(created_at);
CREATE INDEX idx_complaint_official_status ON complaints(official_id, status);
CREATE INDEX idx_complaint_history_complaint ON complaint_history(complaint_id);
CREATE INDEX idx_otp_requests_email ON otp_requests(email, expires_at);
