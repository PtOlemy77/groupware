import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('procurement migration preserves business data and enforces owner, alert and rule relations', async () => {
  const db = new PGlite();
  try {
    for (const name of ['V1__preserve_and_secure_schema.sql', 'V2__enforce_code_columns.sql']) await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/' + name, 'utf8'));
    await db.exec("INSERT INTO employees(emp_no,name,department,position,email,phone,hire_date,status,leave_remaining,leave_total,skills,avatar_color,role,password) VALUES ('SYNTH-G2B','Synthetic procurement user','사업본부','담당','synthetic-procurement@example.invalid','','2026-01-01','재직',5,15,'','indigo','일반직원','synthetic-placeholder')");
    const before = (await db.query('SELECT * FROM employees')).rows;
    await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/V9__procurement_watch.sql', 'utf8'));
    assert.deepEqual((await db.query('SELECT * FROM employees')).rows, before);
    assert.equal((await db.query('SELECT count(*)::int n FROM procurement_sync_state')).rows[0].n, 17);
    assert.equal((await db.query('SELECT count(*)::int n FROM procurement_rules')).rows[0].n, 0);
    await db.exec("INSERT INTO procurement_rules(employee_id,name,keywords,excluded_keywords,institutions,match_mode,notice_kind,business_type) VALUES (1,'Synthetic rule','GIS','','','AND','ALL','SERVC')");
    await assert.rejects(db.exec("INSERT INTO procurement_rules(employee_id,name,keywords,excluded_keywords,institutions,match_mode,notice_kind,business_type) VALUES (999,'Invalid owner','GIS','','','AND','ALL','SERVC')"), /foreign key/i);
    await db.exec("INSERT INTO procurement_notices(kind,business_type,external_id,revision,fingerprint,title,agency,demand_agency,agency_code,demand_agency_code,published_at,changed_at,deadline,budget,notice_status,source_url) VALUES ('BID','SERVC','SYNTH-NOTICE','001','synthetic-hash','Synthetic GIS notice','Synthetic agency','','','','2026-11-09','','','','등록공고','https://www.g2b.go.kr/')");
    await db.exec("INSERT INTO procurement_alerts(employee_id,notice_id,matched_rules) VALUES (1,1,'Synthetic rule')");
    await assert.rejects(db.exec("INSERT INTO procurement_alerts(employee_id,notice_id,matched_rules) VALUES (1,1,'Duplicate')"), /duplicate/i);
    await db.exec("INSERT INTO procurement_alert_rules(alert_id,rule_id,rule_name) VALUES (1,1,'Synthetic rule')");
    await db.exec('DELETE FROM procurement_rules WHERE id=1');
    assert.deepEqual((await db.query('SELECT rule_id,rule_name FROM procurement_alert_rules')).rows, [{ rule_id: null, rule_name: 'Synthetic rule' }]);
    assert.equal((await db.query('SELECT count(*)::int n FROM procurement_alerts')).rows[0].n, 1);
    await assert.rejects(db.exec('DELETE FROM employees WHERE id=1'), /foreign key/i);
    assert.deepEqual((await db.query('SELECT * FROM employees')).rows, before);
  } finally { await db.close(); }
});
