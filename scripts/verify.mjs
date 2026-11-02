import { spawnSync } from 'node:child_process';
const flags = process.argv.slice(2);
if (flags.some(flag => flag !== '--browser')) throw new Error('Usage: node scripts/verify.mjs [--browser]');
const commands = [
  ['node', ['scripts/check-harness.mjs']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['test']],
  ['./backend/mvnw', ['-B', '-f', 'backend/pom.xml', 'verify']],
  ['npm', ['run', 'build']],
];
if (flags.includes('--browser')) commands.push(['npm', ['run', 'test:e2e']]);
for (const [command, args] of commands) {
  console.log(`\n[verify] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, HARNESS_BUILD_READY: '1' } });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`\nPASS: ${flags.includes('--browser') ? 'full harness including browser' : 'core harness; browser not run'}`);
