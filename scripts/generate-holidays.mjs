import fs from 'node:fs';
import { buildHolidays, holidaySql } from './holiday-data.mjs';

const rows = buildHolidays();
fs.writeFileSync('src/data/korean-holidays.json', JSON.stringify(rows, null, 2) + '\n');
fs.mkdirSync('scripts/maintenance', { recursive: true });
fs.writeFileSync('scripts/maintenance/holidays-through-2040.sql', `-- Explicit maintenance only. Back up holidays and confirm DB before execution.
-- Do not run on application startup. Existing IDs/custom rows are preserved.
-- Correct only the known V5 seed value; never rewrite a user-edited row.
UPDATE holidays SET holiday_date = DATE '2028-05-02', updated_on = CURRENT_TIMESTAMP
WHERE holiday_date = DATE '2028-06-02' AND holiday_name = '부처님오신날'
  AND is_statutory = true AND description = '법정공휴일'
  AND NOT EXISTS (SELECT 1 FROM holidays WHERE holiday_date = DATE '2028-05-02' AND holiday_name = '부처님오신날');
UPDATE holidays SET holiday_name = '노동절', is_statutory = true, updated_on = CURRENT_TIMESTAMP
WHERE holiday_date BETWEEN DATE '2026-01-01' AND DATE '2040-12-31'
  AND to_char(holiday_date, 'MM-DD') = '05-01' AND holiday_name = '근로자의 날'
  AND is_statutory = false AND description = '유급휴일'
  AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.holiday_date = holidays.holiday_date AND h.holiday_name = '노동절');
${holidaySql(rows)}
`);
console.log(`Generated ${rows.length} holiday records for 2024–2040.`);
