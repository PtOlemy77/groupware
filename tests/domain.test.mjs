import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path) {
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const domain=await load('src/types/groupware.ts'), calendar=await load('src/lib/calendar.ts');
test('revenue outside the project period is zero',()=>{
 const project={budget:12000,our_budget:6000,share_rate:50,start_date:'2027-01-01',end_date:'2027-12-31'};
 assert.equal(domain.getMultiYearRevenueForYear(project,2026),0);
 assert.equal(domain.getMultiYearRevenueForYear(project,2027),6000);
 assert.equal(domain.getMultiYearRevenueForYear(project,2028),0);
});
test('zero share and zero own budget remain zero',()=>{
 const project={budget:1000,our_budget:0,share_rate:0,start_date:'2027-01-01',end_date:'2027-12-31'};
 assert.equal(domain.getProjectShareRate(project),0);assert.equal(domain.getProjectOurBudget(project),0);
});
test('custom revenue allocation preserves total and applies share once',()=>{
 const project={budget:1000,our_budget:500,share_rate:50,start_date:'2026-11-01',end_date:'2027-02-28',yearly_revenue_json:'{"2026":800,"2027":200}'};
 assert.equal(domain.getMultiYearRevenueForYear(project,2026),400);assert.equal(domain.getMultiYearRevenueForYear(project,2027),100);
});
test('multi-year rounding preserves the exact total',()=>{
 const revenue=domain.calculateMultiYearRevenues('2026-11-01','2028-02-28',1001);
 assert.equal(Object.values(revenue).reduce((a,b)=>a+b,0),1001);
});
test('future and past contracts contribute no current-year workload',()=>{
 assert.deepEqual(calendar.monthlyAllocations('2027-01-01','2027-12-31',Array(12).fill(1),2026),Array(12).fill(0));
 assert.deepEqual(calendar.monthlyAllocations('2025-01-01','2025-12-31',Array(12).fill(1),2026),Array(12).fill(0));
});
test('multi-year workforce uses the correct source month offset',()=>{
 const months=[.1,.2,.3,.4];
 assert.deepEqual(calendar.monthlyAllocations('2026-11-01','2027-02-28',months,2026),[0,0,0,0,0,0,0,0,0,0,.1,.2]);
 assert.deepEqual(calendar.monthlyAllocations('2026-11-01','2027-02-28',months,2027),[.3,.4,0,0,0,0,0,0,0,0,0,0]);
});
test('missing allocations are zero rather than inferred full-time',()=>{
 assert.deepEqual(calendar.monthlyAllocations('2026-01-01','2026-12-31',[],2026),Array(12).fill(0));
});
test('missing years in an explicit allocation stay zero',()=>{
 const p={budget:1000,our_budget:1000,share_rate:100,start_date:'2026-01-01',end_date:'2027-12-31',yearly_revenue_json:'{"2027":1000}'};
 assert.equal(domain.getMultiYearRevenueForYear(p,2026),0);
});
test('invalid periods never fabricate revenue in a default year',()=>{
 assert.deepEqual(domain.calculateMultiYearRevenues('','',1000),{});
 assert.deepEqual(domain.calculateMultiYearRevenues('2027-01-01','2026-01-01',1000),{});
});
