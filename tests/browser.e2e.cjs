const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:13000';
const artifacts = path.resolve('test-results/e2e');
fs.mkdirSync(artifacts, { recursive: true });
fs.rmSync(path.join(artifacts, 'failure.png'), { force: true });
const processes = [], logFiles = [];
let browser;
async function unusedPort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Test port ${port} is in use; no existing server will be stopped.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
function server(command, args, name) {
  const out = fs.openSync(path.join(artifacts, name + '.log'), 'w'); logFiles.push(out);
  const child = spawn(command, args, { stdio: ['ignore', out, out], env: { ...process.env, API_INTERNAL_URL: 'http://127.0.0.1:18080' } });
  child.startError = null;
  child.on('error', error => { child.startError = error; });
  processes.push(child); return child;
}
async function ready(url, child) {
  for (let i = 0; i < 120; i++) {
    if (child.startError || child.exitCode !== null) throw new Error(`Test server exited before readiness. See ${artifacts}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Test server failed to start: ${url}. See ${artifacts}`);
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}
(async () => {
  await unusedPort(13000); await unusedPort(18080);
  const cp = [path.resolve('backend/target/test-classes'), path.resolve('backend/target/classes'), fs.readFileSync(process.env.HARNESS_CLASSPATH_FILE, 'utf8').trim()].join(path.delimiter);
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java';
  const backend = server(java, ['-cp', cp, 'com.nexus.groupware.GroupwareBackendApplication', '--spring.profiles.active=test', '--spring.datasource.url=jdbc:h2:mem:groupware-smoke;MODE=PostgreSQL;DB_CLOSE_DELAY=-1', '--spring.datasource.driver-class-name=org.h2.Driver', '--spring.datasource.username=sa', '--spring.datasource.password=', '--spring.flyway.enabled=false', '--spring.jpa.hibernate.ddl-auto=create-drop', '--server.address=127.0.0.1', '--server.port=18080', '--app.bootstrap.email=review-admin@spatialt.co.kr', '--app.bootstrap.password=Temporary-review-password!', '--debug=false'], 'backend');
  await ready('http://127.0.0.1:18080/api/health', backend);
  const frontend = server(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '13000', '--strictPort'], 'frontend');
  await ready(base, frontend);
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [], dialogs = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { dialogs.push(dialog.type()); void dialog.dismiss(); });
  try {
    await page.goto(base);
    await page.getByRole('heading', { name: /AI 시대, 좋은 시스템은/ }).waitFor();
    await page.getByRole('link', { name: '개인정보 처리방침', exact: true }).click();
    await page.getByRole('heading', { name: '개인정보 처리방침', exact: true }).waitFor();
    await page.getByRole('link', { name: '포털로 돌아가기' }).click();
    await page.getByRole('link', { name: '임직원 로그인' }).click();
    await page.getByLabel('사내 아이디').fill('review-admin');
    await page.getByLabel('비밀번호', { exact: true }).fill('Temporary-review-password!');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('heading', { name: '초기 비밀번호 변경' }).waitFor();
    await page.getByLabel('현재 비밀번호', { exact: true }).fill('Temporary-review-password!');
    await page.getByLabel('새 비밀번호 (12자 이상)', { exact: true }).fill('Browser-new-password!');
    await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('Browser-new-password!');
    await page.getByRole('button', { name: '비밀번호 변경 및 업무 시작' }).click();
    await page.getByRole('heading', { name: '통합 대시보드', exact: true }).waitFor();
    async function mutate(payload) {
      const token = (await (await page.request.get(base + '/api/auth/csrf')).json()).token;
      const response = await page.request.post(base + '/api/groupware', { headers: { 'X-CSRF-TOKEN': token }, data: payload });
      assert.equal(response.status(), 200, await response.text()); return (await response.json()).record;
    }
    await mutate({ module: 'employees', action: 'create', data: { name: 'Review Executive', email: 'browser-exec@spatialt.co.kr', phone: '', hire_date: '2026-01-01', status_code: 'STATUS_ACTIVE', department_code: 'DEPT_BIZ', position_code: 'POS_DIR', role_code: 'ROLE_EXEC', password: 'Executive-password!' } });
    await mutate({ module: 'projects', action: 'create', data: { name: '브라우저 검증 프로젝트', department: 'DEPT_BIZ', start_date: '2027-01-01', end_date: '2027-12-31', budget: 1000, share_rate: 50, status: '프로젝트 수행', progress: 0 } });
    await page.getByRole('button', { name: /^프로젝트 관리/ }).first().click();
    await page.getByText('브라우저 검증 프로젝트', { exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
    await page.getByRole('button', { name: '계약품의서', exact: true }).first().click();
    const contract = page.getByRole('dialog').last(); await contract.waitFor();
    const contractTitle = page.getByPlaceholder('계약명 또는 상단 프로젝트 불러오기 클릭');
    await contractTitle.fill('저장하지 않을 검증 초안');
    await page.keyboard.press('Escape');
    const unsaved = page.getByRole('dialog', { name: '변경 내용 확인', exact: true });
    await unsaved.waitFor();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), '확인');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), '취소');
    await page.keyboard.press('Escape');
    await unsaved.waitFor({ state: 'detached' });
    assert.equal(await contractTitle.inputValue(), '저장하지 않을 검증 초안');
    assert.equal(await contractTitle.evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Escape');
    await unsaved.getByRole('button', { name: '확인', exact: true }).click();
    await contract.waitFor({ state: 'detached' });
    const reportWrites = [];
    const trackReportWrite = request => { if (request.url().endsWith('/api/groupware') && request.method() === 'POST') reportWrites.push(request.url()); };
    page.on('request', trackReportWrite);
    await page.getByRole('button', { name: '주간/월간 보고', exact: true }).first().click();
    await page.getByRole('heading', { name: /주간.*월간 보고/ }).first().waitFor();
    assert.equal(await page.locator('textarea').first().inputValue(), '');
    const reports = await (await page.request.get(base + '/api/groupware?scope=reports')).json();
    assert.equal(reports.approvals.length, 0, 'Opening a report must not create a saved document');
    assert.deepEqual(reportWrites, [], 'Report entry must not attempt a write');
    page.off('request', trackReportWrite);
    await page.getByRole('button', { name: /^직원 관리/ }).first().click();
    await page.getByText('Review Executive', { exact: true }).first().waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    await page.getByRole('button', { name: /^프로젝트 관리/ }).first().click();
    assert.equal(await page.getByRole('button', { name: '메뉴 열기', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    await page.reload(); await page.getByRole('heading', { name: '프로젝트 관리', exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('link', { name: '스패셜티 포털' }).click();
    await page.getByRole('button', { name: '공지 관리', exact: true }).click();
    await page.getByRole('button', { name: '공지 작성', exact: true }).click();
    await page.getByLabel('제목', { exact: false }).last().fill('격리 검증 공지');
    await page.getByLabel('내용', { exact: false }).last().fill('HTML은 실행되지 않습니다: <script>window.harnessInjected = true</script>');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    const confirmation = page.getByRole('dialog');
    await confirmation.waitFor();
    await confirmation.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await page.locator('#notice-title-input').inputValue(), '격리 검증 공지');
    await page.getByLabel('포털에 게시').check();
    await page.getByRole('button', { name: '저장하고 게시' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click();
    await page.getByRole('button', { name: '공개 목록 보기' }).click();
    await page.getByRole('button', { name: /격리 검증 공지/ }).click();
    await page.getByRole('heading', { name: '격리 검증 공지', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.harnessInjected), undefined);
    // A fresh browser context verifies anonymous access rather than the admin's cookie.
    const anonymous = await browser.newContext();
    const anonPage = await anonymous.newPage();
    const response = await anonPage.request.get(base + '/api/portal/notices');
    assert.equal(response.status(), 200); assert.equal((await response.json()).total, 1);
    await anonymous.close();
    await page.getByRole('link', { name: '임직원 로그인' }).click();
    await page.getByRole('heading', { name: '통합 대시보드', exact: true }).waitFor();
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page.getByRole('button', { name: '로그인', exact: true }).waitFor();
    assert.deepEqual(dialogs, [], 'Native alert/confirm dialogs are forbidden');
    assert.deepEqual(errors, []);
    console.log('PASS: portal/privacy → forced password change → project/contract/report → mobile/session → modal cancel → notice publish/anonymous read → logout');
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await Promise.all(processes.map(stop));
  for (const fd of logFiles) fs.closeSync(fd);
});
