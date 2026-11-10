-- V10__common_codes_and_master_data.sql
-- 사내 공통 코드(부서, 직급, 권한, 재직상태, 프로젝트단계) 및 연도별 마스터 데이터(목표매출, SW노임단가) DB 영속화

-- 1. 부서 코드 (DEPARTMENT)
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('DEPARTMENT', '조직 부서', 'DEPT_CEO', '대표이사', 1, true, 'ROOT'),
  ('DEPARTMENT', '조직 부서', 'DEPT_BIZ', '사업본부', 2, true, 'DEPT_CEO'),
  ('DEPARTMENT', '조직 부서', 'DEPT_RND', '기술연구소', 3, true, 'DEPT_CEO'),
  ('DEPARTMENT', '조직 부서', 'DEPT_QM', '품질경영팀', 4, true, 'DEPT_CEO'),
  ('DEPARTMENT', '조직 부서', 'DEPT_MGMT', '경영지원팀', 5, true, 'ROOT')
ON CONFLICT (group_code, code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    extra_value = EXCLUDED.extra_value;

-- 2. 직급 코드 (POSITION)
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('POSITION', '직급 체계', 'POS_STAFF', '담당', 1, true, '1'),
  ('POSITION', '직급 체계', 'POS_AM', '대리', 2, true, '2'),
  ('POSITION', '직급 체계', 'POS_MGR', '과장', 3, true, '3'),
  ('POSITION', '직급 체계', 'POS_DGM', '차장', 4, true, '4'),
  ('POSITION', '직급 체계', 'POS_GM', '부장', 5, true, '5'),
  ('POSITION', '직급 체계', 'POS_DIR', '이사', 6, true, '6'),
  ('POSITION', '직급 체계', 'POS_CEO', '사장', 7, true, '7')
ON CONFLICT (group_code, code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    extra_value = EXCLUDED.extra_value;

-- 3. 시스템 권한 코드 (ROLE)
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('ROLE', '시스템 권한', 'ROLE_STAFF', '일반직원', 1, true, '{"rank":1,"desc":"일반 실무자"}'),
  ('ROLE', '시스템 권한', 'ROLE_PM', 'PM 권한', 2, true, '{"rank":2,"desc":"사업·프로젝트 생성 및 품의서 작성"}'),
  ('ROLE', '시스템 권한', 'ROLE_EXEC', '임원 권한', 3, true, '{"rank":3,"desc":"품의서 승인·반려 및 인사평가 확정"}'),
  ('ROLE', '시스템 권한', 'ROLE_ADMIN', '시스템 관리자', 4, true, '{"rank":4,"desc":"시스템 설정 및 공통코드 총괄"}')
ON CONFLICT (group_code, code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    extra_value = EXCLUDED.extra_value;

-- 4. 재직 상태 코드 (EMPLOYEE_STATUS)
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('EMPLOYEE_STATUS', '재직 상태', 'STATUS_ACTIVE', '재직', 1, true, '정상 근무 재직자'),
  ('EMPLOYEE_STATUS', '재직 상태', 'STATUS_LEAVE', '휴직', 2, true, '육아/병가 등 일시 휴직자'),
  ('EMPLOYEE_STATUS', '재직 상태', 'STATUS_RETIRED', '퇴사', 3, true, '퇴직 처리자')
ON CONFLICT (group_code, code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    extra_value = EXCLUDED.extra_value;

-- 5. 프로젝트 단계 코드 (PROJECT_STAGE)
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('PROJECT_STAGE', '프로젝트 단계', 'STAGE_ORDER', '발주예상', 1, true, '예산 반영 및 공고 대기'),
  ('PROJECT_STAGE', '프로젝트 단계', 'STAGE_PROPOSAL', '제안준비중', 2, true, '제안서 및 사전원가 산출'),
  ('PROJECT_STAGE', '프로젝트 단계', 'STAGE_EXEC', '프로젝트 수행', 3, true, '계약 체결 및 개발 과제 수행'),
  ('PROJECT_STAGE', '프로젝트 단계', 'STAGE_DONE', '완료', 4, true, '최종 검수 및 프로젝트 종료')
ON CONFLICT (group_code, code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    extra_value = EXCLUDED.extra_value;

-- 6. 시스템 전사 마스터 데이터 (목표매출 및 SW 기술자 노임단가표 DB 영속화)
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('MASTER_TARGETS', '연도별 목표매출', 'DATA', '기준정보', 1, true,
   '{"2024":{"year":2024,"targetAmount":200000,"note":"공공 공간정보 사업 기반 확립"},"2025":{"year":2025,"targetAmount":250000,"note":"지자체 SI/SM 및 디지털트윈 사업 확대"},"2026":{"year":2026,"targetAmount":300000,"note":"전사 목표 매출 30억 수주 달성"},"2027":{"year":2027,"targetAmount":350000,"note":"클라우드 SaaS 및 신기술 R&D 확장"}}'),
  ('MASTER_PRICES', '연도별 노임단가', 'DATA', '기준정보', 2, true,
   '{"2024":[{"id":1,"position":"사장","grade":"특급","monthlyPrice":12500,"dailyPrice":598086},{"id":2,"position":"이사","grade":"특급","monthlyPrice":11500,"dailyPrice":550239},{"id":3,"position":"부장","grade":"특급","monthlyPrice":10500,"dailyPrice":502392},{"id":4,"position":"차장","grade":"고급","monthlyPrice":9000,"dailyPrice":430622},{"id":5,"position":"과장","grade":"고급","monthlyPrice":8000,"dailyPrice":382775},{"id":6,"position":"대리","grade":"중급","monthlyPrice":6500,"dailyPrice":311004},{"id":7,"position":"담당","grade":"초급","monthlyPrice":5200,"dailyPrice":248803}],"2025":[{"id":1,"position":"사장","grade":"특급","monthlyPrice":13000,"dailyPrice":622009},{"id":2,"position":"이사","grade":"특급","monthlyPrice":12000,"dailyPrice":574162},{"id":3,"position":"부장","grade":"특급","monthlyPrice":11000,"dailyPrice":526315},{"id":4,"position":"차장","grade":"고급","monthlyPrice":9500,"dailyPrice":454545},{"id":5,"position":"과장","grade":"고급","monthlyPrice":8500,"dailyPrice":406698},{"id":6,"position":"대리","grade":"중급","monthlyPrice":7000,"dailyPrice":334928},{"id":7,"position":"담당","grade":"초급","monthlyPrice":5500,"dailyPrice":263157}],"2026":[{"id":1,"position":"사장","grade":"특급","monthlyPrice":13500,"dailyPrice":645933},{"id":2,"position":"이사","grade":"특급","monthlyPrice":12500,"dailyPrice":598086},{"id":3,"position":"부장","grade":"특급","monthlyPrice":11500,"dailyPrice":550239},{"id":4,"position":"차장","grade":"고급","monthlyPrice":10000,"dailyPrice":478468},{"id":5,"position":"과장","grade":"고급","monthlyPrice":9000,"dailyPrice":430622},{"id":6,"position":"대리","grade":"중급","monthlyPrice":7500,"dailyPrice":358851},{"id":7,"position":"담당","grade":"초급","monthlyPrice":5800,"dailyPrice":277511}],"2027":[{"id":1,"position":"사장","grade":"특급","monthlyPrice":14000,"dailyPrice":669856},{"id":2,"position":"이사","grade":"특급","monthlyPrice":13000,"dailyPrice":622009},{"id":3,"position":"부장","grade":"특급","monthlyPrice":12000,"dailyPrice":574162},{"id":4,"position":"차장","grade":"고급","monthlyPrice":10500,"dailyPrice":502392},{"id":5,"position":"과장","grade":"고급","monthlyPrice":9500,"dailyPrice":454545},{"id":6,"position":"대리","grade":"중급","monthlyPrice":8000,"dailyPrice":382775},{"id":7,"position":"담당","grade":"초급","monthlyPrice":6200,"dailyPrice":296650}]}')
ON CONFLICT (group_code, code) DO UPDATE
SET group_name = EXCLUDED.group_name,
    code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    extra_value = EXCLUDED.extra_value;
