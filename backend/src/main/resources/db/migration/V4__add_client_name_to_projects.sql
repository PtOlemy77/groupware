-- Add client_name to projects for synchronizing client info with contract approvals
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name varchar(255) DEFAULT '';

-- Populate existing projects' client_name from linked contract approvals if available
UPDATE projects p
SET client_name = COALESCE((
  SELECT a.vendor
  FROM approvals a
  WHERE a.project_id = p.id
    AND a.category LIKE '%계약%'
    AND a.vendor IS NOT NULL
    AND a.vendor != ''
  ORDER BY a.id DESC
  LIMIT 1
), '');

-- Set known clients for existing mock/sample projects if still empty
UPDATE projects SET client_name = '충청북도청' WHERE code = 'PRJ-2026-02' AND (client_name IS NULL OR client_name = '');
UPDATE projects SET client_name = '농촌진흥청' WHERE code = 'PRJ-2026-03' AND (client_name IS NULL OR client_name = '');
UPDATE projects SET client_name = '전기안전공사' WHERE code = 'PRJ-2026-06' AND (client_name IS NULL OR client_name = '');
UPDATE projects SET client_name = '한국국토정보공사' WHERE code = 'PRJ-2026-05' AND (client_name IS NULL OR client_name = '');
UPDATE projects SET client_name = '한국국토정보공사' WHERE code = 'PRJ-2026-01' AND (client_name IS NULL OR client_name = '');
UPDATE projects SET client_name = '행정안전부' WHERE code = 'PRJ-2026-04' AND (client_name IS NULL OR client_name = '');
