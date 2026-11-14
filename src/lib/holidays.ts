import registeredHolidays from '../data/korean-holidays.json';
import type { Holiday } from '../types/groupware';

/**
 * DB에 저장된 공휴일·사내 휴일 데이터를 유지하면서, 누락된 법정 공휴일 정의를 날짜별로 보완 및 병합한다.
 */
export function calendarHolidays(holidays: Holiday[]): Holiday[] {
  const mergedList = [...holidays];

  // 1. DB에 아직 등록되지 않은 기본 법정 공휴일 보충 (음수 ID 부여)
  for (const [index, registered] of registeredHolidays.entries()) {
    const alreadyExistsInDb = holidays.some(
      (existing) =>
        existing.is_statutory &&
        existing.holiday_date === registered.holiday_date &&
        existing.holiday_name.split(' / ').includes(registered.holiday_name),
    );

    if (!alreadyExistsInDb) {
      mergedList.push({ ...registered, id: -(index + 1) });
    }
  }

  // 2. 같은 날짜·동일 구분(법정/사내)에 속한 복수 공휴일(예: 어린이날 / 부처님오신날)을 하나로 병합
  const groupedByDate = new Map<string, Holiday>();

  for (const holiday of mergedList) {
    const key = `${holiday.holiday_date}:${holiday.is_statutory}`;
    const existing = groupedByDate.get(key);

    if (!existing) {
      groupedByDate.set(key, { ...holiday });
      continue;
    }

    const mergedNames = new Set([
      ...existing.holiday_name.split(' / '),
      ...holiday.holiday_name.split(' / '),
    ]);
    existing.holiday_name = [...mergedNames].join(' / ');

    const descriptions = [existing.description, holiday.description].filter(Boolean);
    existing.description = [...new Set(descriptions)].join(' · ');
  }

  return [...groupedByDate.values()].sort((a, b) =>
    a.holiday_date.localeCompare(b.holiday_date),
  );
}
