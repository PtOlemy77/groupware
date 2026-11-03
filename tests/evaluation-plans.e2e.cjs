const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async({browser,mutate,base,artifacts})=>{
 const password='Synthetic-HR-password!',changedPassword='Synthetic-HR-changed-password!';
 const year=new Date().getFullYear(),month=new Date().toISOString().slice(0,7);
 const create=async(key,role='ROLE_STAFF')=>mutate({module:'employees',action:'create',data:{name:'수행평가검증 '+key,emp_no:'HR-E2E-'+key,email:'hr-e2e-'+key+'@spatialt.co.kr',phone:'010-0000-0000',hire_date:'2020-01-01',department_code:'DEPT_BIZ',position_code:'POS_MGR',role_code:role,status_code:'STATUS_ACTIVE',password}});
 const staff=await create('staff'),pm=await create('pm','ROLE_PM'),exec=await create('exec','ROLE_EXEC'),outsider=await create('outsider'),pool=await create('pool');
 await mutate({module:'projects',action:'create',data:{name:'수행평가 격리 프로젝트',department_code:'DEPT_BIZ',pm_id:pm.id,member_ids:[staff.id],start_date:year+'-01-01',end_date:year+'-12-31',budget:100,share_rate:100,status_code:'STAGE_EXEC',progress:0}});
 const contexts=[],errors=[];
 async function session(employee){
  const context=await browser.newContext();contexts.push(context);
  let token=(await(await context.request.get(base+'/api/auth/csrf')).json()).token;
  let r=await context.request.post(base+'/api/auth/login',{headers:{'X-CSRF-TOKEN':token},data:{identifier:employee.email,password}});assert.equal(r.status(),200,await r.text());
  token=(await(await context.request.get(base+'/api/auth/csrf')).json()).token;
  r=await context.request.post(base+'/api/auth/password',{headers:{'X-CSRF-TOKEN':token},data:{current_password:password,new_password:changedPassword}});assert.equal(r.status(),200,await r.text());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Native dialog '+d.type());void d.dismiss();});
  await page.goto(base+'/#evaluations');await page.getByRole('heading',{name:'인사 평가 관리',exact:true}).first().waitFor();await page.getByRole('table',{name:'수행평가 목록',exact:true}).waitFor();
  return {context,page};
 }
 async function action(page,label,endpoint,confirm){
  const wait=page.waitForResponse(r=>r.url().endsWith(endpoint)&&r.request().method()==='POST');
  await page.getByRole('button',{name:label,exact:true}).click();
  if(confirm)await page.locator('[data-global-modal]').getByRole('button',{name:confirm,exact:true}).click();
  const r=await wait;assert.equal(r.status(),200,await r.text());return r.json();
 }
 async function open(page){await page.reload();await page.getByRole('button',{name:'화면 수행목표 상세',exact:true}).click();return page.getByRole('dialog',{name:'수행평가 상세',exact:true});}
 try {
  const owner=await session(staff),reviewer=await session(pm),executive=await session(exec),other=await session(outsider);
  const p=owner.page;
  await p.getByRole('button',{name:'수행목표 작성',exact:true}).click();let d=p.getByRole('dialog',{name:'수행평가 작성',exact:true});
  await d.getByLabel('목표 제목',{exact:true}).fill('화면 수행목표');
  await d.press('Escape');
  await p.locator('[data-global-modal]').getByRole('button',{name:'취소',exact:true}).click();
  assert.equal(await d.isVisible(),true);
  assert.equal(await d.getByLabel('목표 제목',{exact:true}).inputValue(),'화면 수행목표');
  for(let i=1;i<=3;i++)await d.getByLabel(`지표 ${i} 목표`,{exact:true}).fill('합성 산출물 100% 완료');
  await d.getByLabel('계획 공수 '+month,{exact:true}).fill('0.5');
  let plan=await action(p,'목표 제출','/submit');let id=plan.id;
  assert.equal(plan.state,'SUBMITTED');assert.equal(await p.getByLabel('목표 제목',{exact:true}).isDisabled(),true);
  let rd=await open(reviewer.page);await rd.getByLabel('검토 의견',{exact:true}).fill('달성기준 보완 확인');
  plan=await action(reviewer.page,'목표 보완 요청','/request_revision');assert.equal(plan.state,'REVISION_REQUIRED');
  d=await open(p);await d.getByLabel('지표 1 목표',{exact:true}).fill('합성 검수 통과율 100%');plan=await action(p,'목표 제출','/submit');assert.equal(plan.state,'SUBMITTED');
  rd=await open(reviewer.page);await rd.getByLabel('검토 의견',{exact:true}).fill('목표 검토 완료');plan=await action(reviewer.page,'목표 승인','/approve','승인');assert.equal(plan.state,'APPROVED');
  const hash=plan.goals_hash,goals=plan.goals;
  await p.reload();await p.getByRole('button',{name:'화면 수행목표 상세',exact:true}).waitFor();
  await p.screenshot({path:path.join(artifacts,'evaluation-list-desktop.png'),fullPage:true});
  d=await open(p);assert.equal(await d.getByLabel('목표 제목',{exact:true}).isDisabled(),true);assert.equal(await d.getByLabel('지표 1 배점',{exact:true}).isDisabled(),true);assert.equal(await d.getByLabel('계획 공수 '+month,{exact:true}).isDisabled(),true);
  for(const width of [390,768]){
   await p.setViewportSize({width,height:900});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const box=await d.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
   const inputs=await d.getByRole('list',{name:'수행목표 입력',exact:true}).boundingBox();assert.ok(inputs.x>=0 && inputs.x+inputs.width<=width+1);
   assert.equal(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   await p.screenshot({path:path.join(artifacts,`evaluation-locked-${width}.png`)});
   await d.getByLabel('지표 1 목표',{exact:true}).scrollIntoViewIfNeeded();
   await p.screenshot({path:path.join(artifacts,`evaluation-goals-${width}.png`)});
  }
  await p.setViewportSize({width:1440,height:1000});
  for(let i=1;i<=3;i++){await d.getByLabel(`지표 ${i} 실적값`,{exact:true}).fill('100');await d.getByLabel(`지표 ${i} 실적 증빙`,{exact:true}).fill('합성 증빙 · 사내 검증 문서 위치');}
  await d.getByLabel('실제 공수 '+month,{exact:true}).fill('0.5');plan=await action(p,'결과 제출','/submit_results');assert.equal(plan.state,'RESULT_SUBMITTED');
  rd=await open(reviewer.page);await rd.getByLabel('검토 의견',{exact:true}).fill('실적 확인과 정량평가 완료');plan=await action(reviewer.page,'평가 확정','/evaluate','확정');assert.equal(plan.score,100);assert.equal(plan.performance_points,35);assert.equal(plan.goals_hash,hash);assert.deepEqual(plan.goals,goals);
  d=await open(p);assert.equal(await d.getByLabel('지표 1 실적값',{exact:true}).isDisabled(),true);await d.getByText('확정 수행점수 100 / 100 · 수행지표 환산 35 / 35',{exact:true}).waitFor();
  const list=async session=>(await(await session.context.request.get(base+'/api/evaluation-plans?year='+year)).json());
  assert.ok((await list(owner)).plans.every(row=>row.employee_id===staff.id));assert.equal((await list(other)).plans.length,0);
  assert.equal((await other.context.request.get(base+'/api/evaluation-plans/'+id)).status(),403);
  assert.ok((await list(reviewer)).plans.some(row=>row.id===id));assert.ok((await list(executive)).plans.some(row=>row.id===id));
  await other.page.getByLabel('수행평가 검색',{exact:true}).fill('화면 수행목표');await other.page.getByText('조회 가능한 수행평가가 없습니다.',{exact:true}).waitFor();
  const poolSession=await session(pool);await poolSession.page.getByRole('button',{name:'인재풀 월별 목표 작성',exact:true}).click();
  const pd=poolSession.page.getByRole('dialog',{name:'수행평가 작성',exact:true});assert.equal(await pd.getByRole('list',{name:'수행목표 입력',exact:true}).getByRole('listitem').count(),5);
  await pd.getByLabel('목표 검토자',{exact:true}).selectOption(String(pm.id));await pd.getByLabel('목표 제목',{exact:true}).fill('합성 인재풀 목표');await action(poolSession.page,'초안 저장','/api/evaluation-plans');
  // A disabled server configuration sends the menu back to the preserved legacy screen.
  await other.page.route('**/api/evaluation-plans/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:false})}));
  await other.page.reload();await other.page.getByRole('heading',{name:'인사 평가 관리',exact:true}).first().waitFor();await other.page.getByPlaceholder('평가대상자, 사번, 피드백 검색...').waitFor();assert.equal(await other.page.getByRole('button',{name:'수행목표 작성',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
 } finally {for(const context of contexts)await context.close();}
};
