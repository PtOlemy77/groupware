import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync('src/lib/calendar.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { groupCalendarEvents } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('calendar groups preserve separate records, category order and details', () => {
  const events = [
    { id: 'a', category: 'project', title: '같은 제목', description: '첫 번째 상세' },
    { id: 'b', category: 'holiday', title: '공휴일' },
    { id: 'c', category: 'project', title: '같은 제목', description: '두 번째 상세' },
    { id: 'd', category: 'event', title: '다른 행사' },
  ];
  const before = structuredClone(events);
  const groups = groupCalendarEvents(events);
  assert.deepEqual(groups.map(g => [g.category, g.events.map(e => e.id)]), [
    ['project', ['a', 'c']], ['holiday', ['b']], ['event', ['d']],
  ]);
  assert.equal(groups[0].events[1].description, '두 번째 상세');
  assert.deepEqual(events, before);
  assert.deepEqual(groupCalendarEvents([]), []);
});
