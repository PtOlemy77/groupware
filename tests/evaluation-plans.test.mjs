import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const code=ts.transpileModule(fs.readFileSync('src/lib/evaluation-plans.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {goalTemplates,achievement,planMonths,goalsEditable,resultsEditable}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('project and pool templates preserve the source category weights independently',()=>{
 assert.deepEqual(goalTemplates('PROJECT').map(g=>g.weight),[35,35,30]);
 assert.deepEqual(goalTemplates('POOL').map(g=>g.weight),[10,10,10,10,10]);
 assert.equal(new Set(goalTemplates('POOL').map(g=>g.category)).size,5);
});
test('quantitative scores cap attainment and distinguish missing and zero results',()=>{
 const g={direction:'HIGHER',target:10};assert.equal(achievement(g,null),null);assert.equal(achievement(g,0),0);assert.equal(achievement(g,5),50);assert.equal(achievement(g,20),100);
 assert.equal(achievement({direction:'LOWER',target:2},4),50);assert.equal(achievement({direction:'LOWER',target:0},0),100);assert.equal(achievement({direction:'LOWER',target:0},1),0);assert.equal(achievement({direction:'MANUAL',target:0},null),null);
});
test('approval locks goals while result revision never unlocks them',()=>{
 for(const state of ['SUBMITTED','APPROVED','RESULT_REVISION_REQUIRED','RESULT_SUBMITTED','EVALUATED'])assert.equal(goalsEditable(state),false);
 for(const state of ['DRAFT','REVISION_REQUIRED'])assert.equal(goalsEditable(state),true);
 for(const state of ['APPROVED','RESULT_REVISION_REQUIRED'])assert.equal(resultsEditable(state),true);
 for(const state of ['DRAFT','SUBMITTED','RESULT_SUBMITTED','EVALUATED'])assert.equal(resultsEditable(state),false);
 assert.deepEqual(planMonths('2026-11-03','2027-02-01'),['2026-11','2026-12','2027-01','2027-02']);assert.deepEqual(planMonths('2026-11-03','2026-10-01'),[]);
});
test('additive workflow migration preserves legacy records and enforces assignment identity',async()=>{
 const db=new PGlite();try {
  for(const name of ['V1__preserve_and_secure_schema.sql','V2__enforce_code_columns.sql'])
   await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/'+name,'utf8'));
  await db.exec("INSERT INTO employees(emp_no,name,department,position,email,phone,hire_date,status,leave_remaining,leave_total,skills,avatar_color,role,password) VALUES ('HR-1','Synthetic subject','사업본부','담당','hr1@example.invalid','','2026-01-01','재직',5,15,'','indigo','일반직원','synthetic'),('HR-2','Synthetic reviewer','사업본부','과장','hr2@example.invalid','','2026-01-01','재직',5,15,'','indigo','PM 권한','synthetic')");
  await db.exec("INSERT INTO projects(code,name,department,pm_name,pm_id,start_date,end_date,status,status_code,progress,budget,share_rate,our_budget,is_consortium,consortium_partners,members,priority,description) VALUES ('HR-P','Synthetic project','사업본부','Synthetic reviewer',2,'2026-01-01','2026-12-31','프로젝트 수행','STAGE_EXEC',0,0,100,0,false,'','','보통','Preserved original')");
  await db.exec('INSERT INTO project_members(project_id,employee_id) VALUES(1,1),(1,2)');
  await db.exec("INSERT INTO evaluations(emp_no,emp_name,department,position,period,kpi_score,competency_score,peer_score,total_score,grade,reviewer,status,feedback,employee_id,reviewer_id) VALUES ('HR-1','Synthetic subject','사업본부','담당','2025',80,70,60,73,'B','Synthetic reviewer','평가완료','Original synthetic feedback',1,2)");
  const legacy=(await db.query('SELECT * FROM evaluations')).rows;
  const before=(await db.query('SELECT * FROM projects')).rows;
  await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/V8__evaluation_goal_workflow.sql','utf8'));
  assert.deepEqual((await db.query('SELECT * FROM projects')).rows,before);
  assert.deepEqual((await db.query('SELECT * FROM evaluations')).rows,legacy);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM evaluation_assignments')).rows[0].n,2);
  const a=(await db.query('SELECT id FROM evaluation_assignments WHERE employee_id=1')).rows[0].id;
  const insert="INSERT INTO evaluation_plans(employee_id,project_id,assignment_id,reviewer_id,kind,state,title,start_date,end_date,goals_json,planned_mm_json) VALUES (1,1,"+a+",2,'PROJECT','DRAFT','Synthetic goal','2026-01-01','2026-01-31','[]','{}')";
  await db.exec(insert);
  await assert.rejects(db.exec(insert.replace('(1,1,','(2,1,')),/check constraint|foreign key/i);
  await assert.rejects(db.exec(insert.replace(",2,'PROJECT'",",1,'PROJECT'")),/check constraint/i);
  await assert.rejects(db.exec('DELETE FROM projects WHERE id=1'),/foreign key/i);
  await assert.rejects(db.exec("INSERT INTO evaluation_assignments(employee_id,project_id,assigned_on) VALUES(1,1,'2026-02-01')"),/duplicate/i);
  await db.exec("UPDATE evaluation_assignments SET ended_on='2026-01-31' WHERE employee_id=1");
  await db.exec("INSERT INTO evaluation_assignments(employee_id,project_id,assigned_on) VALUES(1,1,'2026-02-01')");
  assert.equal((await db.query('SELECT count(*)::int AS n FROM evaluation_plans')).rows[0].n,1);
 } finally {await db.close();}
});
