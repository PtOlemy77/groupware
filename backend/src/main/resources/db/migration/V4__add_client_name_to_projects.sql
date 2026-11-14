-- Add client_name to projects for synchronizing client info with contract approvals
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name varchar(255) DEFAULT '';
