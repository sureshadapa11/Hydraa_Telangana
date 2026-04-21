-- =====================================================
--   Site Visit Multi-Visit Migration — HYDRAA
--   Drops the unique constraint so multiple visits
--   per complaint are allowed
-- =====================================================

ALTER TABLE site_visit_reports DROP INDEX IF EXISTS one_report_per_complaint;
