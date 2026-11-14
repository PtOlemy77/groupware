import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['scripts/check-harness.mjs']],
  ['npm', ['run', 'typecheck']],
  ['./backend/mvnw', ['-B', '-f', 'backend/pom.xml', 'verify']],
  ['npm', ['run', 'build']],
];

for (const [command, args] of commands) {
  console.log(`\n[verify] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, HARNESS_BUILD_READY: '1' },
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\nPASS: harness, typecheck, backend verify, and frontend build');
