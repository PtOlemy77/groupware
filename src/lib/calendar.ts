export function monthlyAllocations(
  start: string,
  end: string,
  values: number[],
  year: number,
): number[] {
  const match = (s: string) => /^(\d{4})-(\d{2})-\d{2}$/.exec(s);
  const a = match(start),
    b = match(end),
    result = Array<number>(12).fill(0);
  if (!a || !b) return result;
  const first = Number(a[1]) * 12 + Number(a[2]) - 1,
    last = Number(b[1]) * 12 + Number(b[2]) - 1;
  for (let month = 0; month < 12; month++) {
    const absolute = year * 12 + month,
      index = absolute - first;
    if (index >= 0 && absolute <= last)
      result[month] = Number(values[index] ?? 0);
  }
  return result;
}

/** Period keys use the Korean business date and UTC date arithmetic to avoid host timezone drift. */
export function reportPeriods(kind: 'weekly' | 'monthly', now = new Date()) {
  const fields = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const number = (type: string) => Number(fields.find(field => field.type === type)?.value);
  const today = new Date(Date.UTC(number('year'), number('month') - 1, number('day')));
  const pad = (value: number) => String(value).padStart(2, '0');
  return Array.from({ length: kind === 'weekly' ? 53 : 24 }, (_, offset) => {
    const start = new Date(today);
    if (kind === 'monthly') {
      start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - offset);
      const year = start.getUTCFullYear(), month = start.getUTCMonth() + 1;
      return { key: `${year}-${pad(month)}-M`, label: `${year}년 ${month}월 월간보고` };
    }
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7 - offset * 7);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 4);
    const year = start.getUTCFullYear(), month = start.getUTCMonth() + 1;
    const week = Math.floor((start.getUTCDate() - 1) / 7) + 1;
    return { key: `${year}-${pad(month)}-W${week}`, label: `${year}년 ${month}월 ${week}주차 (${pad(month)}.${pad(start.getUTCDate())} ~ ${pad(end.getUTCMonth() + 1)}.${pad(end.getUTCDate())})` };
  });
}
