import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function nativeDialogViolations(source, filename = 'input.tsx') {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];
  const names = new Set(['alert', 'confirm']);
  function walk(node) {
    let forbidden = false;
    if (ts.isPropertyAccessExpression(node)) {
      forbidden = ['window', 'globalThis', 'self'].includes(node.expression.getText(tree)) && names.has(node.name.text);
    } else if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression)) {
      forbidden = ['window', 'globalThis', 'self'].includes(node.expression.getText(tree)) && names.has(node.argumentExpression.text);
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      forbidden = names.has(node.expression.text);
    }
    if (forbidden) violations.push(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1);
    ts.forEachChild(node, walk);
  }
  walk(tree);
  return violations;
}
export function sensitiveDocument(source) {
  return /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/.test(source);
}
export function checkHarness(root = process.cwd()) {
  const problems = [];
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of tracked) {
    if (/^export\/(csv\/|groupware_full_dump\.sql$)/.test(file)) problems.push(`${file}: private export must not be tracked`);
  }
  function walk(directory) {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
      const file = path.posix.join(directory, entry.name);
      return entry.isDirectory() ? walk(file) : [file];
    });
  }
  for (const file of walk('src').filter(file => /\.[jt]sx?$/.test(file))) {
    for (const line of nativeDialogViolations(fs.readFileSync(path.join(root, file), 'utf8'), file)) {
      problems.push(`${file}:${line}: native alert/confirm reference; use ModalContext`);
    }
  }
  const documents = ['AGENTS.md', 'README.md', 'export/DATABASE_SPECIFICATION.md', ...walk('harness').filter(file => file.endsWith('.md'))];
  for (const file of documents) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (sensitiveDocument(source)) problems.push(`${file}: password hash found in shared documentation`);
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|#|mailto:)/.test(target)) continue;
      if (target.startsWith('file:')) { problems.push(`${file}: use relative links instead of file://`); continue; }
      const destination = path.resolve(root, path.dirname(file), target.split('#')[0]);
      if (!fs.existsSync(destination)) problems.push(`${file}: missing link target ${target}`);
    }
  }
  return problems;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const problems = checkHarness();
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
  else console.log('PASS: native-dialog guard, private-export tracking, shared-document hashes and links');
}
