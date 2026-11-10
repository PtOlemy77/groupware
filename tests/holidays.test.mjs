import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { buildHolidays } from '../scripts/holiday-data.mjs';

const rows = buildHolidays();
const names = d => rows.filter(r => r.holiday_date === d).map(r => r.holiday_name);
const source = fs.readFileSync('src/lib/holidays.ts', 'utf8').replace("import registeredHolidays from '../data/korean-holidays.json';", `const registeredHolidays = ${JSON.stringify(rows)};`);
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { calendarHolidays } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('registered data is reproducible and covers every year through 2040', () => {
  assert.deepEqual(JSON.parse(fs.readFileSync('src/data/korean-holidays.json', 'utf8')), rows);
  assert.equal(new Set(rows.map(r => r.holiday_date + r.holiday_name)).size, rows.length);
  for (let year = 2024; year <= 2040; year++) {
    assert.ok(names(`${year}-01-01`).includes('신정'));
    assert.ok(names(`${year}-12-25`).includes('성탄절'));
    assert.equal(rows.filter(r => r.holiday_date.startsWith(`${year}-`) && r.holiday_name === '설날').length, 1);
    assert.equal(rows.filter(r => r.holiday_date.startsWith(`${year}-`) && r.holiday_name === '추석').length, 1);
  }
});
test('Korean lunar dates, substitute collisions, and current holiday law', () => {
  assert.ok(names('2028-05-02').includes('부처님오신날'));
  assert.deepEqual(names('2028-06-02'), []);
  assert.ok(names('2040-09-21').includes('추석'));
  assert.ok(names('2027-02-09').includes('설날 대체공휴일'));
  assert.ok(names('2027-05-03').includes('노동절 대체공휴일'));
  assert.ok(names('2027-07-19').includes('제헌절 대체공휴일'));
  assert.equal(rows.filter(r => r.holiday_date.startsWith('2027-')).length, 24);
  assert.deepEqual(names('2027-06-07'), []); // Memorial Day has no substitute.
  assert.deepEqual(names('2028-01-03'), []); // New Year's Day has no substitute.
  assert.equal(rows.filter(r => r.holiday_date.startsWith('2028-10-0') && r.holiday_name.endsWith('대체공휴일')).length, 1);
  assert.deepEqual(names('2025-05-07'), []);
  assert.deepEqual(names('2028-10-06'), []);
  assert.ok(names('2028-04-12').includes('제23대 국회의원선거 (예정)'));
  assert.ok(names('2030-06-12').includes('제10회 전국동시지방선거 (예정)'));
});
test('partial DB data preserves company days and groups overlapping public holidays', () => {
  const db = [{ id: 1, holiday_date: '2025-05-05', holiday_name: '어린이날 / 부처님오신날', is_statutory: true },
    { id: 2, holiday_date: '2040-09-21', holiday_name: '합성 회사기념일', is_statutory: false }];
  const before = structuredClone(db), merged = calendarHolidays(db);
  assert.deepEqual(db, before);
  assert.equal(merged.filter(r => r.holiday_date === '2025-05-05').length, 1);
  assert.equal(merged.filter(r => r.holiday_date === '2040-09-21').length, 2);
  assert.ok(merged.some(r => r.holiday_date === '2040-12-25'));
});
test('explicit maintenance corrects known seed while preserving IDs, custom rows and repeat runs', async () => {
  const db = new PGlite();
  try {
    await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/V5__holidays.sql', 'utf8'));
    await db.exec("INSERT INTO holidays(holiday_date,holiday_name,is_statutory,description) VALUES ('2032-07-01','합성 회사 휴일',false,'보존 확인')");
    const custom = (await db.query("SELECT * FROM holidays WHERE holiday_name='합성 회사 휴일'")).rows;
    const old = (await db.query("SELECT id FROM holidays WHERE holiday_date='2028-06-02' AND holiday_name='부처님오신날'")).rows[0];
    const sql = fs.readFileSync('scripts/maintenance/holidays-through-2040.sql', 'utf8');
    await db.exec(sql);
    assert.equal((await db.query("SELECT id FROM holidays WHERE holiday_date='2028-05-02' AND holiday_name='부처님오신날'")).rows[0].id, old.id);
    assert.deepEqual((await db.query("SELECT * FROM holidays WHERE holiday_name='합성 회사 휴일'")).rows, custom);
    const before = (await db.query('SELECT * FROM holidays ORDER BY id')).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT * FROM holidays ORDER BY id')).rows, before);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM holidays WHERE holiday_date >= '2031-01-01'")).rows[0].n > 190, true);
  } finally { await db.close(); }
});
