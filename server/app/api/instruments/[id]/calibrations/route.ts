import { api } from '@/lib/api';
import { requireRole, MANAGE, HttpError } from '@/lib/auth';
import { query, one } from '@/lib/db';
import { calibrationSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = api(async (_r, { params }) => { const s = await requireRole();
  return query(`SELECT c.*, u.name AS recorded_by_name FROM calibration_records c JOIN instruments i ON i.id=c.instrument_id LEFT JOIN users u ON u.id=c.recorded_by
                 WHERE i.org_id=$1 AND i.id=$2 ORDER BY calibrated_on DESC`, [s.orgId, Number(params.id)]); });
/** Record a calibration; next due defaults to date + interval. FAIL takes the instrument out of service. */
export const POST = api(async (req, { params }) => { const s = await requireRole(...MANAGE); const d = calibrationSchema.parse(await req.json());
  const i = await one(`SELECT * FROM instruments WHERE id=$1 AND org_id=$2`, [Number(params.id), s.orgId]); if (!i) throw new HttpError(404, 'Not found');
  if (d.calibrated_on > new Date().toISOString().slice(0, 10)) throw new HttpError(422, 'Calibration date cannot be in the future');
  return one(`INSERT INTO calibration_records(instrument_id,calibrated_on,agency,certificate_no,result,error_found,next_due,recorded_by)
              VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date, $2::date + $8::int),$9) RETURNING *`,
    [i.id, d.calibrated_on, d.agency, d.certificate_no, d.result, d.error_found, d.next_due ?? null, i.calibration_interval_days, s.uid]); });
