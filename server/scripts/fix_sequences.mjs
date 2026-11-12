import { Pool } from 'pg';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.split('=').slice(1).join('=').trim();
  }
}
const pool = new Pool({ connectionString: dbUrl });

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update next_no function in plpgsql
    await client.query(`
      CREATE OR REPLACE FUNCTION next_no(p_org INT, p_type TEXT) RETURNS TEXT AS $$
      DECLARE
        n INT;
        y INT := EXTRACT(YEAR FROM CURRENT_DATE);
        max_existing INT := 0;
      BEGIN
        IF p_type IN ('IPQC', 'FQC', 'IQC') THEN
          SELECT COALESCE(MAX(SUBSTRING(insp_no FROM '-([0-9]+)$')::int), 0)
            INTO max_existing
            FROM inspections
           WHERE org_id = p_org AND stage::text = p_type AND insp_no LIKE (p_type || '-' || y || '-%');
        ELSIF p_type = 'NCR' THEN
          SELECT COALESCE(MAX(SUBSTRING(ncr_no FROM '-([0-9]+)$')::int), 0)
            INTO max_existing
            FROM ncrs
           WHERE org_id = p_org AND ncr_no LIKE ('NCR-' || y || '-%');
        ELSIF p_type = 'CAPA' THEN
          SELECT COALESCE(MAX(SUBSTRING(capa_no FROM '-([0-9]+)$')::int), 0)
            INTO max_existing
            FROM capas
           WHERE org_id = p_org AND capa_no LIKE ('CAPA-' || y || '-%');
        END IF;

        INSERT INTO doc_series (org_id, doc_type, yr, last_no)
        VALUES (p_org, p_type, y, GREATEST(max_existing, 0) + 1)
        ON CONFLICT (org_id, doc_type, yr)
        DO UPDATE SET last_no = GREATEST(doc_series.last_no, max_existing) + 1
        RETURNING last_no INTO n;

        RETURN p_type || '-' || y || '-' || lpad(n::TEXT, 4, '0');
      END $$ LANGUAGE plpgsql;
    `);

    // 2. Synchronize current doc_series table values
    const stages = ['IPQC', 'FQC', 'IQC'];
    for (const st of stages) {
      await client.query(`
        INSERT INTO doc_series (org_id, doc_type, yr, last_no)
        SELECT org_id, $1::text, 2026, COALESCE(MAX(SUBSTRING(insp_no FROM '-([0-9]+)$')::int), 0)
        FROM inspections
        WHERE stage::text = $1::text AND insp_no LIKE ($1 || '-2026-%')
        GROUP BY org_id
        ON CONFLICT (org_id, doc_type, yr)
        DO UPDATE SET last_no = GREATEST(doc_series.last_no, EXCLUDED.last_no);
      `, [st]);
    }

    // Sync NCR
    await client.query(`
      INSERT INTO doc_series (org_id, doc_type, yr, last_no)
      SELECT org_id, 'NCR', 2026, COALESCE(MAX(SUBSTRING(ncr_no FROM '-([0-9]+)$')::int), 0)
      FROM ncrs
      WHERE ncr_no LIKE 'NCR-2026-%'
      GROUP BY org_id
      ON CONFLICT (org_id, doc_type, yr)
      DO UPDATE SET last_no = GREATEST(doc_series.last_no, EXCLUDED.last_no);
    `);

    // Sync CAPA
    await client.query(`
      INSERT INTO doc_series (org_id, doc_type, yr, last_no)
      SELECT org_id, 'CAPA', 2026, COALESCE(MAX(SUBSTRING(capa_no FROM '-([0-9]+)$')::int), 0)
      FROM capas
      WHERE capa_no LIKE 'CAPA-2026-%'
      GROUP BY org_id
      ON CONFLICT (org_id, doc_type, yr)
      DO UPDATE SET last_no = GREATEST(doc_series.last_no, EXCLUDED.last_no);
    `);

    await client.query('COMMIT');
    console.log('MIGRATION APPLIED SUCCESSFULLY!');

    const updated = await client.query('SELECT * FROM doc_series ORDER BY doc_type');
    console.log('Updated doc_series:', updated.rows);

    // Test calling next_no for each stage
    const testIPQC = await client.query("SELECT next_no(1, 'IPQC') as no");
    console.log('Next IPQC test:', testIPQC.rows[0].no);
    const testNCR = await client.query("SELECT next_no(1, 'NCR') as no");
    console.log('Next NCR test:', testNCR.rows[0].no);
    const testCAPA = await client.query("SELECT next_no(1, 'CAPA') as no");
    console.log('Next CAPA test:', testCAPA.rows[0].no);

    // Rollback the test increments
    await client.query("UPDATE doc_series SET last_no = last_no - 1 WHERE org_id = 1 AND doc_type IN ('IPQC', 'NCR', 'CAPA')");
    console.log('Rolled back test increments cleanly.');

    const finalSeries = await client.query('SELECT * FROM doc_series ORDER BY doc_type');
    console.log('Final doc_series ready for production:', finalSeries.rows);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
fix();
