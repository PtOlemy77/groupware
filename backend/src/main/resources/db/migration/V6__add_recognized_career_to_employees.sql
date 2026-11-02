-- 직원 인정 경력(년, 개월) 컬럼 추가 (기본값 0)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS recognized_career_years integer NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS recognized_career_months integer NOT NULL DEFAULT 0;

ALTER TABLE employees ADD CONSTRAINT ck_employees_recognized_career CHECK (
  recognized_career_years >= 0 AND recognized_career_years <= 70 AND
  recognized_career_months >= 0 AND recognized_career_months <= 11
);

