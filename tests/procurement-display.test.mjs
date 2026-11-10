import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync('src/lib/procurement-display.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { procurementAmount, procurementDate, procurementTerms, procurementSourceUrl } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('compact notice amounts retain exact large and decimal won values', () => {
  assert.equal(procurementAmount('1000000'), '1,000,000원');
  assert.equal(procurementAmount('99999999999999999.010'), '99,999,999,999,999,999.01원');
  assert.equal(procurementAmount('0'), '0원');
  assert.equal(procurementAmount('0000123.000'), '123원');
  for (const value of ['', '미제공', 'NaN', '-1']) assert.equal(procurementAmount(value), '—');
});
test('registration and deadline display retain the supplied business time', () => {
  assert.equal(procurementDate('2026-11-09 10:30:00'), '2026-11-09 10:30');
  assert.equal(procurementDate('2026-11-09T18:05:00'), '2026-11-09 18:05');
  assert.equal(procurementDate(''), '—');
});
test('full width keyword summary removes duplicate and empty terms across rules', () => {
  assert.deepEqual(procurementTerms(['GIS, 공간정보\n측량', 'GIS\n  공간정보  ', '']), ['GIS', '공간정보', '측량']);
});
test('original notice links only permit official HTTPS URLs without credentials', () => {
  assert.equal(procurementSourceUrl('https://www.g2b.go.kr/synthetic-notice'), 'https://www.g2b.go.kr/synthetic-notice');
  for (const value of ['javascript:alert(1)', 'https://g2b.go.kr.evil.invalid/', 'https://user:secret@www.g2b.go.kr/', 'http://www.g2b.go.kr/', '']) assert.equal(procurementSourceUrl(value), '');
});
