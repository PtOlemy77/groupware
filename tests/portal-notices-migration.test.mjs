import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('notice migration preserves employees, links authors by FK and enforces safe defaults', async () => {
  const db = new PGlite();
  try {
    await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/V1__preserve_and_secure_schema.sql', 'utf8'));
    const employee = (await db.query(`INSERT INTO employees(emp_no,name,department_code,department,position_code,position,email,phone,hire_date,status,leave_remaining,leave_total,skills,avatar_color,role,password)
      VALUES ('NOTICE-1','Notice Admin','DEPT_RND','연구소','POS_STAFF','담당','notice@spatialt.co.kr','','2026-01-01','재직',15,15,'','indigo','시스템 관리자','unchanged-hash') RETURNING id`)).rows[0];
    await db.exec(fs.readFileSync('backend/src/main/resources/db/migration/V3__portal_notices.sql', 'utf8'));
    assert.equal((await db.query('SELECT password FROM employees WHERE id=$1', [employee.id])).rows[0].password, 'unchanged-hash');
    const notice = (await db.query(`INSERT INTO portal_notices(title,content,created_by_id) VALUES ('News','Body',$1) RETURNING *`, [employee.id])).rows[0];
    assert.equal(notice.published, false);
    assert.equal(notice.pinned, false);
    assert.equal(Number(notice.version), 0);
    await assert.rejects(db.exec("INSERT INTO portal_notices(title,content,created_by_id) VALUES ('Invalid','Body',999999)"), /foreign key/i);
    await assert.rejects(db.exec("INSERT INTO portal_notices(title,content,created_by_id) VALUES ('  ','Body'," + employee.id + ')'), /check constraint/i);
    await assert.rejects(db.query('DELETE FROM employees WHERE id=$1', [employee.id]), /foreign key/i);
    assert.equal((await db.query('SELECT count(*)::int AS total FROM portal_notices')).rows[0].total, 1);
  } finally { await db.close(); }
});
