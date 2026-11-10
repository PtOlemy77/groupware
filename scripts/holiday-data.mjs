import fs from 'node:fs';

// KASI Korean lunar conversion values: never substitute the Chinese lunar calendar.
const lunar = JSON.parse(fs.readFileSync(new URL('../src/data/korean-lunar-holidays.json', import.meta.url), 'utf8'));
const date = value => new Date(`${value}T00:00:00Z`);
const day = value => date(value).getUTCDay();
const shift = (value, n) => { const d = date(value); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function buildHolidays() {
  const result = [];
  for (const { year, seollal, buddha, chuseok } of lunar.years) {
    const rows = [], groups = [];
    const add = (holiday_date, holiday_name, kind = 'regular') => rows.push({ holiday_date, holiday_name, is_statutory: true, description: `${year >= 2028 ? '현행법 기준 예상 · ' : ''}${kind === 'substitute' ? '대체공휴일' : '법정공휴일'}` });
    const group = (name, dates, weekends = true) => { dates.forEach(d => add(d, name)); groups.push({ name, dates, weekends }); };
    add(`${year}-01-01`, '신정');
    group('삼일절', [`${year}-03-01`]);
    if (year >= 2026) { group('노동절', [`${year}-05-01`]); group('제헌절', [`${year}-07-17`]); }
    group('어린이날', [`${year}-05-05`]);
    add(`${year}-06-06`, '현충일');
    group('광복절', [`${year}-08-15`]);
    group('개천절', [`${year}-10-03`]);
    group('한글날', [`${year}-10-09`]);
    group('성탄절', [`${year}-12-25`]);
    for (const [name, center] of [['설날', seollal], ['추석', chuseok]]) {
      const dates = [-1, 0, 1].map(n => shift(center, n));
      dates.forEach((d, i) => add(d, i === 1 ? name : `${name} 연휴`));
      groups.push({ name, dates, weekends: false });
    }
    group('부처님오신날', [buddha]);
    // Coincident public holidays share one substitute (2025-05-05 and 2028-10-03).
    // Independent weekend holidays still earn separate substitutes.
    const base = [...rows];
    const merged = [];
    for (const g of groups) {
      const overlaps = merged.filter(m => m.dates.some(d => g.dates.includes(d)));
      if (!overlaps.length) { merged.push({ ...g }); continue; }
      const combined = [...overlaps, g];
      merged.splice(0, merged.length, ...merged.filter(m => !overlaps.includes(m)));
      merged.push({ name: combined.find(m => m.dates.length > 1)?.name || '',
        dates: [...new Set(combined.flatMap(m => m.dates))].sort(), weekends: combined.some(m => m.weekends) });
    }
    for (const g of merged.sort((a, b) => a.dates[0].localeCompare(b.dates[0]))) {
      const needs = g.dates.some(d => day(d) === 0 || (g.weekends && day(d) === 6) ||
        (day(d) !== 0 && day(d) !== 6 && base.filter(r => r.holiday_date === d).length > 1));
      if (!needs) continue;
      let next = shift(g.dates.at(-1), 1);
      while (day(next) === 0 || day(next) === 6 || rows.some(r => r.holiday_date === next)) next = shift(next, 1);
      add(next, g.name ? `${g.name} 대체공휴일` : '대체공휴일', 'substitute');
    }
    result.push(...rows);
  }
  const extra = (d, n, description) => result.push({ holiday_date: d, holiday_name: n, is_statutory: true, description });
  extra('2024-04-10', '제22대 국회의원선거', '임기만료 선거일');
  extra('2024-10-01', '국군의 날 (임시공휴일)', '임시공휴일');
  extra('2025-01-27', '임시공휴일', '정부 지정 임시공휴일');
  extra('2025-06-03', '제21대 대통령선거 (임시공휴일)', '정부 지정 임시공휴일');
  extra('2026-06-03', '제9회 전국동시지방선거', '임기만료 선거일');
  // Article 34 projections, assuming current terms continue. Check NEC notices
  // again before each election; ad hoc/by-elections are not nationwide holidays.
  for (let year = 2028; year <= 2040; year++) {
    const elections = [];
    if ((year - 2028) % 4 === 0) elections.push([`${year}-05-29`, 50, `제${23 + (year - 2028) / 4}대 국회의원선거`]);
    if ((year - 2030) % 4 === 0 && year >= 2030) elections.push([`${year}-06-30`, 30, `제${10 + (year - 2030) / 4}회 전국동시지방선거`]);
    if ((year - 2030) % 5 === 0 && year >= 2030) elections.push([`${year}-06-03`, 70, `제${22 + (year - 2030) / 5}대 대통령선거`]);
    for (const [end, days, name] of elections) {
      let d = shift(end, -days);
      do { d = shift(d, 1); } while (day(d) !== 3);
      while ([-1, 0, 1].some(n => result.some(r => r.holiday_date === shift(d, n)))) d = shift(d, 7);
      extra(d, `${name} (예정)`, '공직선거법 제34조 계산 · 선관위 공고 및 임시공휴일 지정에 따라 변경 가능');
    }
  }
  return result.sort((a, b) => a.holiday_date.localeCompare(b.holiday_date) || a.holiday_name.localeCompare(b.holiday_name, 'ko'));
}

export function holidaySql(rows = buildHolidays()) {
  const q = value => `'${value.replaceAll("'", "''")}'`;
  return `INSERT INTO holidays (holiday_date, holiday_name, is_statutory, description) VALUES\n${rows.map(r => `(${q(r.holiday_date)}, ${q(r.holiday_name)}, true, ${q(r.description)})`).join(',\n')}\nON CONFLICT (holiday_date, holiday_name) DO NOTHING;\n`;
}
