-- =====================================================
--   Police Stations — Add officer rank columns
--   Run once against Railway MySQL
-- =====================================================

ALTER TABLE police_stations
  ADD COLUMN IF NOT EXISTS commissionerate VARCHAR(100)    AFTER mandal_id,
  ADD COLUMN IF NOT EXISTS ci_name         VARCHAR(100)    AFTER officer_in_charge,
  ADD COLUMN IF NOT EXISTS ci_phone        VARCHAR(20)     AFTER ci_name,
  ADD COLUMN IF NOT EXISTS ci_email        VARCHAR(100)    AFTER ci_phone,
  ADD COLUMN IF NOT EXISTS acp_name        VARCHAR(100)    AFTER ci_email,
  ADD COLUMN IF NOT EXISTS acp_phone       VARCHAR(20)     AFTER acp_name,
  ADD COLUMN IF NOT EXISTS acp_email       VARCHAR(100)    AFTER acp_phone,
  ADD COLUMN IF NOT EXISTS sp_name         VARCHAR(100)    AFTER acp_email,
  ADD COLUMN IF NOT EXISTS sp_phone        VARCHAR(20)     AFTER sp_name,
  ADD COLUMN IF NOT EXISTS sp_email        VARCHAR(100)    AFTER sp_phone,
  ADD COLUMN IF NOT EXISTS cp_name         VARCHAR(100)    AFTER sp_email,
  ADD COLUMN IF NOT EXISTS cp_phone        VARCHAR(20)     AFTER cp_name,
  ADD COLUMN IF NOT EXISTS cp_email        VARCHAR(100)    AFTER cp_phone;
