import registeredHolidays from '../data/korean-holidays.json';
import type { Holiday } from '../types/groupware';

/** Supplement partial DB data by date, preserving company and custom holidays. */
export function calendarHolidays(holidays: Holiday[]): Holiday[] {
  const result = [...holidays];
  for (const [index, row] of registeredHolidays.entries()) {
    if (holidays.some(h => h.is_statutory && h.holiday_date === row.holiday_date &&
      h.holiday_name.split(' / ').includes(row.holiday_name))) continue;
    result.push({ ...row, id: -(index + 1) });
  }
  // Multiple public holidays can share one date (e.g. Children's Day/Buddha).
  const grouped = new Map<string, Holiday>();
  for (const row of result) {
    const key = `${row.holiday_date}:${row.is_statutory}`;
    const existing = grouped.get(key);
    if (!existing) grouped.set(key, { ...row });
    else {
      const names = new Set([...existing.holiday_name.split(' / '), ...row.holiday_name.split(' / ')]);
      existing.holiday_name = [...names].join(' / ');
      existing.description = [...new Set([existing.description, row.description].filter(Boolean))].join(' · ');
    }
  }
  return [...grouped.values()].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
}
