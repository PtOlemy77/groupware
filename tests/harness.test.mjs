import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeDialogViolations, sensitiveDocument } from '../scripts/check-harness.mjs';

test('native dialog guard blocks calls, monkey patches, aliases and bracket access', () => {
  for (const source of ['window.alert("x")', 'window.confirm = fn', 'const original = window.confirm', 'globalThis["confirm"]("x")', 'self.alert("x")', 'confirm("x")']) {
    assert.ok(nativeDialogViolations(source).length > 0, source);
  }
  assert.deepEqual(nativeDialogViolations('await showConfirm("x", { title: "Confirm" }); // window.alert is forbidden\nconst text = "window.confirm";'), []);
});
test('documentation guard identifies credential hashes without exposing their values', () => {
  const synthetic = '$2b$12$' + 'x'.repeat(53);
  assert.equal(sensitiveDocument('example ' + synthetic), true);
  assert.equal(sensitiveDocument('password is stored with BCrypt; never export hashes'), false);
});
