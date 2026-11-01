import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const sql=fs.readFileSync('backend/src/main/resources/db/migration/V1__preserve_and_secure_schema.sql','utf8');
const person="INSERT INTO employees(emp_no,name,department_code,department,position_code,position,email,phone,hire_date,status,leave_remaining,leave_total,skills,avatar_color,role,password) VALUES ('EMP-1','Review User','DEPT_BIZ','사업본부','POS_MGR','과장','review@spatialt.co.kr','','2026-01-01','재직',5,15,'','indigo','PM 권한','1234') RETURNING id";
test('fresh PostgreSQL migration creates native dates, unique identities and foreign keys',async()=>{
 const db=new PGlite();try{
  await db.exec(sql);const id=(await db.query(person)).rows[0].id;
  assert.equal((await db.query("SELECT data_type FROM information_schema.columns WHERE table_name='projects' AND column_name='start_date'")).rows[0].data_type,'date');
  await assert.rejects(db.exec(person.replace("'EMP-1'","'EMP-2'").replace("'review@spatialt.co.kr'","'REVIEW@spatialt.co.kr'")),/duplicate/i);
  await assert.rejects(db.exec("INSERT INTO project_members(project_id,employee_id) VALUES (999,999)"),/foreign key/i);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM employees')).rows[0].n,1);assert.ok(id);
 }finally{await db.close();}
});
test('legacy migration preserves rows and resolves unambiguous employee/project links',async()=>{
 const db=new PGlite();try{
  await db.exec(fs.readFileSync('tests/fixtures/legacy-schema.sql','utf8'));
  const id=(await db.query(person)).rows[0].id;
  await db.exec("INSERT INTO projects(code,name,department,pm_name,start_date,end_date,status,progress,budget,share_rate,our_budget,is_consortium,consortium_partners,members,priority,description) VALUES ('LEGACY-1','Original contract project','사업본부','Review User','2026-01-01','2027-12-31','진행중',25,1000,50,500,true,'','Review User','보통','Original description')");
  await db.exec('BEGIN');await db.exec(sql);await db.exec('COMMIT');
  const p=(await db.query('SELECT * FROM projects')).rows[0];assert.equal(p.name,'Original contract project');assert.equal(p.description,'Original description');assert.equal(p.budget,1000);assert.equal(p.pm_id,id);assert.equal(p.version,0);
  assert.equal((await db.query('SELECT employee_id FROM project_members')).rows[0].employee_id,id);
  assert.equal((await db.query('SELECT password FROM employees')).rows[0].password,'1234'); // credential migration is a separate tested Java transaction
 }finally{await db.close();}
});
test('invalid existing data aborts the migration without deleting business rows',async()=>{
 const db=new PGlite();try{
  await db.exec(fs.readFileSync('tests/fixtures/legacy-schema.sql','utf8'));await db.exec(person);await db.exec(person.replace("'EMP-1'","'EMP-2'"));
  await db.exec('BEGIN');await assert.rejects(db.exec(sql),e=>e.code==='23505');await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM employees')).rows[0].n,2);
 }finally{await db.close();}
});
