-- V7: 지급 장비 구분을 모니터, 데스크탑, 노트북 3종으로 정규화
UPDATE equipments
SET category = '모니터'
WHERE category NOT IN ('모니터', '데스크탑', '노트북')
  AND (asset_no LIKE 'ST-MN%' OR model_name ILIKE '%monitor%' OR model_name ILIKE '%ultrasharp%' OR model_name ILIKE '%모니터%');

UPDATE equipments
SET category = '노트북'
WHERE category NOT IN ('모니터', '데스크탑', '노트북')
  AND (asset_no LIKE 'ST-NB%' OR model_name ILIKE '%gram%' OR model_name ILIKE '%macbook%' OR model_name ILIKE '%thinkpad%' OR model_name ILIKE '%precision%' OR model_name ILIKE '%galaxy book%');

UPDATE equipments
SET category = '데스크탑'
WHERE category NOT IN ('모니터', '데스크탑', '노트북');

-- 공통 코드 그룹 등록: EQUIPMENT_CATEGORY
INSERT INTO common_codes (group_code, group_name, code, code_name, sort_order, is_active, extra_value)
VALUES
  ('EQUIPMENT_CATEGORY', '지급 장비 구분', 'EQ_MONITOR', '모니터', 1, true, '업무용 디스플레이 모니터'),
  ('EQUIPMENT_CATEGORY', '지급 장비 구분', 'EQ_DESKTOP', '데스크탑', 2, true, '업무용 데스크탑 및 본체 장비'),
  ('EQUIPMENT_CATEGORY', '지급 장비 구분', 'EQ_LAPTOP', '노트북', 3, true, '사내 업무용 노트북/랩탑')
ON CONFLICT (group_code, code) DO UPDATE
SET code_name = EXCLUDED.code_name,
    sort_order = EXCLUDED.sort_order,
    extra_value = EXCLUDED.extra_value,
    is_active = EXCLUDED.is_active;

