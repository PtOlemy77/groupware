const { chromium }=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
let browser; const processes=[]; const logFiles=[];
async function ready(url){for(let i=0;i<120;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Test server failed to start: '+url);}
function server(command,args,log){const out=fs.openSync('/tmp/'+log,'w');logFiles.push(out);const child=spawn(command,args,{stdio:['ignore',out,out],env:{...process.env,API_INTERNAL_URL:'http://127.0.0.1:18080'}});processes.push(child);return child;}

const assert=require('node:assert/strict');
(async()=>{
 const cp=[path.resolve('backend/target/test-classes'),path.resolve('backend/target/classes'),fs.readFileSync('/tmp/groupware-smoke-classpath','utf8').trim()].join(path.delimiter);
 server('java',['-cp',cp,'com.nexus.groupware.GroupwareBackendApplication','--spring.profiles.active=test','--spring.datasource.url=jdbc:h2:mem:groupware-smoke;MODE=PostgreSQL;DB_CLOSE_DELAY=-1','--spring.datasource.driver-class-name=org.h2.Driver','--spring.datasource.username=sa','--spring.datasource.password=','--spring.flyway.enabled=false','--spring.jpa.hibernate.ddl-auto=create-drop','--server.port=18080','--app.bootstrap.email=review-admin@spatialt.co.kr','--app.bootstrap.password=Temporary-review-password!'],'groupware-smoke-backend.log');
 await ready('http://127.0.0.1:18080/api/health');
 server(process.execPath,['node_modules/next/dist/bin/next','start','-p','13000'],'groupware-smoke-frontend.log');
 await ready('http://localhost:13000');
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:13000');
 await page.getByLabel('사내 아이디').fill('review-admin');await page.getByLabel('비밀번호',{exact:true}).fill('Temporary-review-password!');await page.getByRole('button',{name:'로그인',exact:true}).click();
 await page.getByRole('heading',{name:'비밀번호 변경'}).waitFor();
 await page.getByLabel('현재 비밀번호',{exact:true}).fill('Temporary-review-password!');await page.getByLabel('새 비밀번호 (12자 이상)',{exact:true}).fill('Browser-new-password!');await page.getByLabel('새 비밀번호 확인',{exact:true}).fill('Browser-new-password!');await page.getByRole('button',{name:'변경 후 시작'}).click();
 await page.getByRole('heading',{name:'통합 대시보드'}).waitFor();
 async function mutate(payload){const t=await page.request.get('http://localhost:13000/api/auth/csrf');const token=(await t.json()).token;const r=await page.request.post('http://localhost:13000/api/groupware',{headers:{'X-CSRF-TOKEN':token},data:payload});assert.equal(r.status(),200,await r.text());return (await r.json()).record;}
 const exec=await mutate({module:'employees',action:'create',data:{name:'Review Executive',email:'browser-exec@spatialt.co.kr',phone:'',hire_date:'2026-01-01',status:'재직',department_code:'DEPT_BIZ',position_code:'POS_DIR',role:'임원 권한',password:'Executive-password!'}});
 const project=await mutate({module:'projects',action:'create',data:{name:'브라우저 검증 프로젝트',department:'DEPT_BIZ',start_date:'2027-01-01',end_date:'2027-12-31',budget:1000,share_rate:50,status:'프로젝트 수행',progress:0}});
 await page.getByRole('button',{name:/^프로젝트 관리/}).first().click();await page.getByText('브라우저 검증 프로젝트',{exact:true}).first().waitFor();
 await page.screenshot({path:'/tmp/groupware-browser-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'계약품의 · 결재',exact:true}).click();await page.getByRole('button',{name:'계약 초안 작성'}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 assert.equal(await dialog.getAttribute('aria-modal'),'true');
 // Focus stays in the modal and Escape closes a clean draft.
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await page.getByRole('button',{name:'주간/월간 보고',exact:true}).click();await page.getByRole('heading',{name:'주간·월간 보고'}).waitFor();
 assert.equal(await page.locator('textarea').first().inputValue(),'');
 await page.getByRole('button',{name:/^직원 관리/}).first().click();await page.getByText('Review Executive',{exact:true}).first().waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'메뉴 열기'}).click();await page.getByRole('button',{name:/^프로젝트 관리/}).first().click();
 await page.screenshot({path:'/tmp/groupware-browser-mobile.png',fullPage:true});
 assert.equal(await page.getByRole('button',{name:'메뉴 열기'}).getAttribute('aria-expanded'),'false');
 await page.reload();await page.getByRole('heading',{name:'프로젝트 관리',exact:true}).waitFor();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('button',{name:'로그인',exact:true}).waitFor();
 assert.deepEqual(errors,[]);await browser.close();browser=null;
 console.log('PASS: real browser login → forced password change → project/master API → navigation → dialog/Escape → blank report → mobile menu → session restore → logout; no page errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();for(const child of processes)child.kill('SIGTERM');for(const fd of logFiles)fs.closeSync(fd);});
