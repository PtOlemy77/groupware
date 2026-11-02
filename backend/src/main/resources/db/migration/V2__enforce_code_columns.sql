-- V2__enforce_code_columns.sql
-- Enforce system code columns across all entity tables to ensure relational integrity

-- 1. employees: add and backfill status_code
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_code varchar(50) DEFAULT 'STATUS_ACTIVE';

UPDATE employees SET status_code = 'STATUS_ACTIVE' WHERE status IN ('재직', '투입중', '대기') OR status_code IS NULL;
UPDATE employees SET status_code = 'STATUS_LEAVE' WHERE status = '휴직';
UPDATE employees SET status_code = 'STATUS_RETIRED' WHERE status = '퇴사';
UPDATE employees SET status = '재직' WHERE status IN ('투입중', '대기');

-- Normalize department text and code if any mismatch
UPDATE employees SET department = '경영지원팀' WHERE department = '경영지원';

-- 2. projects: add and backfill department_code and status_code
ALTER TABLE projects ADD COLUMN IF NOT EXISTS department_code varchar(50) DEFAULT 'DEPT_BIZ';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_code varchar(50) DEFAULT 'STAGE_EXEC';

UPDATE projects SET department_code = 'DEPT_BIZ' WHERE department = '사업본부';
UPDATE projects SET department_code = 'DEPT_RND' WHERE department = '기술연구소';
UPDATE projects SET department_code = 'DEPT_QM' WHERE department = '품질경영팀';
UPDATE projects SET department_code = 'DEPT_MGMT' WHERE department IN ('경영지원팀', '경영지원');
UPDATE projects SET department_code = 'DEPT_CEO' WHERE department IN ('대표이사', '사장');
UPDATE projects SET department_code = 'DEPT_BIZ' WHERE department_code IS NULL;

UPDATE projects SET status_code = 'STAGE_ORDER' WHERE status = '발주예상';
UPDATE projects SET status_code = 'STAGE_PROPOSAL' WHERE status = '제안준비중';
UPDATE projects SET status_code = 'STAGE_EXEC' WHERE status IN ('프로젝트 수행', '진행중') OR status IS NULL;
UPDATE projects SET status_code = 'STAGE_DONE' WHERE status = '완료';
UPDATE projects SET status_code = 'STAGE_EXEC' WHERE status_code IS NULL;

-- 3. equipments: add and backfill department_code
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS department_code varchar(50) DEFAULT 'DEPT_MGMT';

UPDATE equipments SET department = '경영지원팀' WHERE department = '경영지원';
UPDATE equipments SET department_code = 'DEPT_BIZ' WHERE department = '사업본부';
UPDATE equipments SET department_code = 'DEPT_RND' WHERE department = '기술연구소';
UPDATE equipments SET department_code = 'DEPT_QM' WHERE department = '품질경영팀';
UPDATE equipments SET department_code = 'DEPT_MGMT' WHERE department IN ('경영지원팀', '경영지원') OR department IS NULL;
UPDATE equipments SET department_code = 'DEPT_CEO' WHERE department IN ('대표이사', '사장');
UPDATE equipments SET department_code = 'DEPT_MGMT' WHERE department_code IS NULL;

-- 4. approvals: add and backfill department_code
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS department_code varchar(50) DEFAULT 'DEPT_BIZ';

UPDATE approvals SET department = '경영지원팀' WHERE department = '경영지원';
UPDATE approvals SET department_code = 'DEPT_BIZ' WHERE department = '사업본부';
UPDATE approvals SET department_code = 'DEPT_RND' WHERE department = '기술연구소';
UPDATE approvals SET department_code = 'DEPT_QM' WHERE department = '품질경영팀';
UPDATE approvals SET department_code = 'DEPT_MGMT' WHERE department IN ('경영지원팀', '경영지원');
UPDATE approvals SET department_code = 'DEPT_CEO' WHERE department IN ('대표이사', '사장');
UPDATE approvals SET department_code = 'DEPT_BIZ' WHERE department_code IS NULL;

