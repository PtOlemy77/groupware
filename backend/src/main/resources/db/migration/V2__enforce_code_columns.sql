-- V2__enforce_code_columns.sql
-- Enforce system code columns across all entity tables to ensure relational integrity

-- 1. employees: add status_code column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_code varchar(50) DEFAULT 'STATUS_ACTIVE';

-- 2. projects: add department_code and status_code columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS department_code varchar(50) DEFAULT 'DEPT_BIZ';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_code varchar(50) DEFAULT 'STAGE_EXEC';

-- 3. equipments: add department_code column
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS department_code varchar(50) DEFAULT 'DEPT_MGMT';

-- 4. approvals: add department_code column
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS department_code varchar(50) DEFAULT 'DEPT_BIZ';

