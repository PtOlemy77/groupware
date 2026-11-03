const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function auditMasterLayout({page,mutate,base,artifacts}) {
  const root=page.getByTestId('master-data-view');
  const tab = (name, exact = true) => root.getByRole('tab',{name,exact}).or(root.getByRole('button',{name,exact}));
  const group='AUDIT_LAYOUT_LONG_GROUP_IDENTIFIER_2026';
  const groupName='합성 기준정보 화면 가독성 확인을 위한 긴 그룹 명칭';
  const code='LONG_CODE_IDENTIFIER_FOR_LAYOUT_REVIEW';
  const name='합성 검증용 긴 코드 명칭입니다 공백과 긴 문자열이 포함되어도 전체 내용을 확인할 수 있어야 합니다';
  const description='합성 화면 검증 설명입니다. '.repeat(35).trim();
  const record=await mutate({module:'common_codes',action:'create',data:{group_code:group,group_name:groupName,code,code_name:name,sort_order:1,is_active:true,extra_value:description}});
  await page.getByTitle('최신 데이터 새로고침',{exact:true}).click();
  await tab(/공통 코드 관리/,false).click();
  const search=root.getByPlaceholder('코드, 코드명, 그룹명 검색...');
  await search.fill(group);
  const codes=root.getByRole('table',{name:'공통코드 목록',exact:true});
  const row=codes.locator('tbody tr').filter({hasText:code});
  await row.getByText(name,{exact:true}).waitFor();
  await row.getByText('부가 정보 펼치기',{exact:true}).click();
  assert.equal(await root.locator('#code-description-'+record.id).textContent(),description);
  assert.equal(await root.locator('#code-description-'+record.id).evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
  for(const text of [group,groupName,code,name]) {
    const cell=row.getByText(text,{exact:true});
    assert.equal(await cell.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'Long code text must wrap within its column');
  }
  await page.screenshot({path:path.join(artifacts,'master-codes-desktop.png'),fullPage:true});
  await row.getByRole('button',{name:'수정',exact:false}).click();
  const dialog=page.getByRole('dialog',{name:'공통 코드 수정',exact:true});
  assert.equal(await dialog.getByPlaceholder('예: 사업본부',{exact:true}).inputValue(),name);
  assert.equal(await dialog.getByPlaceholder('예: 프로젝트 전담 부서',{exact:true}).inputValue(),description);
  assert.equal(await dialog.getByPlaceholder('예: 사업본부',{exact:true}).evaluate(node=>node.tagName==='TEXTAREA'&&node.scrollHeight<=node.clientHeight+2),true,'Long name editor must expand to show its content');
  for(const width of [390,768,1024]) {
    await page.setViewportSize({width,height:900});
    await dialog.getByRole('button',{name:'취소',exact:true}).scrollIntoViewIfNeeded();
    assert.equal(await dialog.evaluate(node=>{const panel=node.querySelector('form')?.parentElement||node;const box=panel.getBoundingClientRect();return panel.scrollWidth<=panel.clientWidth+1&&box.left>=0&&box.right<=innerWidth+1&&box.top>=0&&box.bottom<=innerHeight+1;}),true,'Code dialog must fit '+width);
  }
  await dialog.getByRole('button',{name:'취소',exact:true}).click();
  await page.getByRole('dialog',{name:'변경 내용 확인',exact:true}).getByRole('button',{name:'확인',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  const note='합성 사업 목표매출의 긴 전략 설명입니다. '.repeat(12).trim();
  await tab('연도별 사업 목표매출').click();
  await root.getByRole('button',{name:'기준연도 추가',exact:true}).click();
  const targetDialog=page.getByRole('dialog',{name:'신규 연도 사업 목표매출 추가',exact:true});
  await targetDialog.getByPlaceholder('예: 2029',{exact:true}).fill('2030');
  await targetDialog.getByPlaceholder('예: 400000 (40억원)',{exact:true}).fill('123456000');
  await targetDialog.getByPlaceholder('예: AI 기반 공간정보 플랫폼 민간 시장 진출',{exact:true}).fill(note);
  await targetDialog.getByRole('button',{name:'연도 추가',exact:true}).click();
  const targets=root.getByRole('table',{name:'연도별 목표매출',exact:true});
  assert.equal(await targets.getByRole('textbox',{name:'2030년도 목표매출 비고',exact:true}).inputValue(),note);
  assert.equal(await targets.getByRole('textbox',{name:'2030년도 목표매출 비고',exact:true}).evaluate(node=>node.scrollHeight<=node.clientHeight+2),true);
  const save=page.waitForResponse(response=>response.url().endsWith('/api/groupware')&&response.request().method()==='POST');
  await root.getByRole('button',{name:'목표매출 저장',exact:true}).click(); assert.equal((await save).status(),200);
  for(const width of [390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const label of ['연도별 사업 목표매출','연도별 SW 노임단가',/공통 코드 관리/]) {
      const button=tab(label,typeof label==='string');
      await button.click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Master screen must not overflow '+width+' '+label);
      assert.equal(await button.evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'Tab label must fit '+width);
      const table=root.getByRole('table').first();
      const scroll=table.locator('..');
      assert.equal(await scroll.evaluate(node=>{node.scrollLeft=node.scrollWidth;const result=node.scrollLeft+node.clientWidth>=node.scrollWidth-1;node.scrollLeft=0;return result;}),true,'Table must scroll to its last column');
    }
    if(width===390)await page.screenshot({path:path.join(artifacts,'master-codes-mobile.png'),fullPage:true});
  }
  // 새로고침 후 입력값 보존까지 확인하고 합성 코드만 정리한다.
  await page.getByTitle('최신 데이터 새로고침',{exact:true}).click();
  await tab('연도별 사업 목표매출').click();
  assert.equal(await root.getByRole('textbox',{name:'2030년도 목표매출 비고',exact:true}).inputValue(),note);
  await page.screenshot({path:path.join(artifacts,'master-targets-desktop.png'),fullPage:true});
  await tab('연도별 SW 노임단가').click();
  await page.screenshot({path:path.join(artifacts,'master-prices-desktop.png'),fullPage:true});
  await mutate({module:'common_codes',action:'delete',id:record.id,version:record.version});
  await page.getByTitle('최신 데이터 새로고침',{exact:true}).click();
};
