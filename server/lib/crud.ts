import { query, one } from './db';
import { HttpError } from './auth';
export function orgCrud(table: string, cols: string[], order = 'code') {
  return {
    list: (org: number) => query(`SELECT * FROM ${table} WHERE org_id=$1 ORDER BY ${order}`, [org]),
    create: (org: number, d: any) => { const c = cols.filter(k => d[k] !== undefined);
      return one(`INSERT INTO ${table}(org_id,${c.join(',')}) VALUES ($1,${c.map((_, i) => `$${i + 2}`).join(',')}) RETURNING *`, [org, ...c.map(k => d[k])]); },
    update: async (org: number, id: number, d: any) => { const c = cols.filter(k => d[k] !== undefined);
      if (!c.length) throw new HttpError(400, 'Nothing to update');
      const r = await one(`UPDATE ${table} SET ${c.map((k, i) => `${k}=$${i + 3}`).join(',')} WHERE org_id=$1 AND id=$2 RETURNING *`, [org, id, ...c.map(k => d[k])]);
      if (!r) throw new HttpError(404, 'Not found'); return r; },
  };
}
export const products = orgCrud('products', ['code', 'name', 'drawing_no', 'revision', 'uom', 'category', 'customer', 'active']);
export const suppliers = orgCrud('suppliers', ['code', 'name', 'contact', 'email', 'approval']);
export const defects = orgCrud('defect_codes', ['code', 'name', 'category', 'severity', 'active']);
export const instruments = orgCrud('instruments', ['code', 'name', 'type', 'make', 'serial_no', 'range_text', 'least_count', 'location', 'calibration_interval_days', 'out_of_service']);
export const workOrders = orgCrud('work_orders', ['wo_no', 'product_id', 'line_id', 'planned_qty', 'start_date', 'end_date', 'status'], 'id DESC');
