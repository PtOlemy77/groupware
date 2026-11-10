import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync('src/lib/procurement-navigation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { procurementLocation, procurementFilter } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('all eight notification categories and totals retain their exact filters on reload', () => {
  for (const kind of ['ALL', 'BID', 'SPEC']) for (const business of ['ALL', 'SERVC', 'THNG', 'CNSTWK', 'FRGCPT']) {
    const filter = { kind, business, unread: true };
    assert.deepEqual(procurementFilter('#' + procurementLocation(filter)), filter);
  }
});
test('unrecognized link filters safely return to the complete notice list', () => {
  assert.deepEqual(procurementFilter('#procurement?kind=ADMIN&business=BAD&unread=anything'), { kind: 'ALL', business: 'ALL', unread: false });
  assert.deepEqual(procurementFilter('#procurement'), { kind: 'ALL', business: 'ALL', unread: false });
});
