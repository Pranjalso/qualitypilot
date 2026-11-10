import { z } from 'zod';
const optStr = z.string().trim().optional().nullable().transform(v => (v ? v : null));
const optNum = z.union([z.coerce.number(), z.literal(''), z.null()]).optional().transform(v => (v === '' || v == null ? null : Number(v)));
const optId = z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional().transform(v => (v ? Number(v) : null));
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const STAGES = ['IQC', 'IPQC', 'FQC', 'PDI'] as const;
const SEV = ['CRITICAL', 'MAJOR', 'MINOR'] as const;

export const productSchema = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), drawing_no: optStr, revision: z.string().trim().default('A'),
  uom: z.string().default('NOS'), category: optStr, customer: optStr, active: z.coerce.boolean().default(true) });
export const supplierSchema = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), contact: optStr, email: optStr,
  approval: z.enum(['APPROVED', 'CONDITIONAL', 'BLOCKED']).default('APPROVED') });
export const defectSchema = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1),
  category: z.enum(['DIMENSIONAL', 'VISUAL', 'FUNCTIONAL', 'MATERIAL', 'PACKING']), severity: z.enum(SEV), active: z.coerce.boolean().default(true) });
export const instrumentSchema = z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), type: z.string().trim().min(1), make: optStr, serial_no: optStr,
  range_text: optStr, least_count: optStr, location: optStr, calibration_interval_days: z.coerce.number().int().positive().default(365), out_of_service: z.coerce.boolean().default(false) });
export const calibrationSchema = z.object({ calibrated_on: date, agency: z.string().trim().min(2), certificate_no: z.string().trim().min(1),
  result: z.enum(['PASS', 'FAIL', 'ADJUSTED']), error_found: optStr, next_due: date.optional() });
export const lineSchema = z.object({ plant_id: z.coerce.number().int(), code: z.string().trim().min(1), name: z.string().trim().min(1) });

export const planSchema = z.object({
  product_id: z.coerce.number().int().positive(), stage: z.enum(STAGES), title: z.string().trim().min(2),
  sampling_method: z.enum(['FIXED', 'PERCENT', 'HUNDRED', 'ISO2859']), sample_size: optNum, sample_percent: optNum,
  accept_number: z.coerce.number().int().min(0).default(0), notes: optStr,
  characteristics: z.array(z.object({
    name: z.string().trim().min(1), type: z.enum(['VARIABLE', 'ATTRIBUTE']), unit: optStr, nominal: optNum, lsl: optNum, usl: optNum,
    instrument_type: optStr, method: optStr, severity: z.enum(SEV).default('MAJOR'), samples: optNum, spc: z.coerce.boolean().default(false),
  }).refine(c => c.type === 'ATTRIBUTE' || c.lsl != null || c.usl != null, 'Variable characteristics need at least one spec limit')
    .refine(c => c.lsl == null || c.usl == null || c.lsl < c.usl, 'LSL must be below USL')).min(1, 'Add at least one characteristic'),
}).refine(p => p.sampling_method !== 'FIXED' || (p.sample_size ?? 0) > 0, 'Fixed sampling needs a sample size')
  .refine(p => p.sampling_method !== 'PERCENT' || ((p.sample_percent ?? 0) > 0 && (p.sample_percent ?? 0) <= 100), 'Give a sample % between 0 and 100');

export const workOrderSchema = z.object({ wo_no: z.string().trim().min(1), product_id: z.coerce.number().int(), line_id: optId, planned_qty: z.coerce.number().positive(),
  start_date: date.optional().nullable(), end_date: date.optional().nullable(), status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']).default('OPEN') });
export const lotSchema = z.object({ lot_no: z.string().trim().min(1), product_id: z.coerce.number().int().positive(), stage: z.enum(STAGES),
  source: z.enum(['SUPPLIER', 'PRODUCTION']), supplier_id: optId, supplier_invoice: optStr, grn_no: optStr, work_order_id: optId, line_id: optId,
  shift: optStr, quantity: z.coerce.number().positive(), lot_date: date.optional() })
  .refine(l => (l.source === 'SUPPLIER') === !!l.supplier_id, 'Supplier lots need a supplier; production lots must not have one');

export const resultsSchema = z.object({ results: z.array(z.object({ characteristic_id: z.coerce.number().int(), sample_no: z.coerce.number().int().positive(),
  value: optNum, ok: z.boolean().optional().nullable(), instrument_id: optId })).max(5000) });
export const defectEntrySchema = z.object({ defect_code_id: z.coerce.number().int(), quantity: z.coerce.number().int().positive(), characteristic_id: optId,
  remarks: optStr, photo_url: z.string().max(2_800_000, 'Photo too large (max ~2 MB)').optional().nullable(), photo_mime: optStr });

export const ncrSchema = z.object({ source: z.enum(['INSPECTION', 'CUSTOMER_COMPLAINT', 'INTERNAL_AUDIT', 'PROCESS', 'SUPPLIER']), lot_id: optId, product_id: optId,
  supplier_id: optId, customer: optStr, title: z.string().trim().min(3), description: z.string().trim().min(3), qty_affected: z.coerce.number().min(0).default(0),
  severity: z.enum(SEV).default('MAJOR'), photo_url: z.string().max(2_800_000).optional().nullable() });
export const dispositionSchema = z.object({ disposition: z.enum(['REWORK', 'SCRAP', 'USE_AS_IS', 'RETURN_TO_SUPPLIER', 'REGRADE', 'SORT_100']),
  disposition_qty: z.coerce.number().min(0), note: z.string().trim().min(3, 'Give a justification'), cost_of_poor_quality: z.coerce.number().min(0).default(0) });

export const capaSchema = z.object({ type: z.enum(['CORRECTIVE', 'PREVENTIVE']).default('CORRECTIVE'), title: z.string().trim().min(3), owner_id: optId, team: optStr,
  problem: z.string().trim().min(5), target_date: date, ncr_ids: z.array(z.coerce.number().int()).default([]) });
export const capaUpdateSchema = z.object({ title: optStr, team: optStr, owner_id: optId, problem: optStr, containment: optStr,
  root_cause_method: z.enum(['5WHY', 'FISHBONE', 'FTA', 'OTHER']).optional().nullable(), whys: z.array(z.string()).max(7).optional(),
  fishbone: z.record(z.string()).optional(), root_cause: optStr, verification: optStr, effective: z.boolean().optional().nullable(), lessons: optStr, target_date: date.optional() })
  .partial();   // only fields actually sent are updated
export const actionSchema = z.object({ kind: z.enum(['CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE']), description: z.string().trim().min(3), owner_id: optId, due_date: date });
export const actionUpdateSchema = z.object({ status: z.enum(['OPEN', 'DONE', 'CANCELLED']), evidence: optStr, completed_on: date.optional() })
  .refine(a => a.status !== 'DONE' || !!a.evidence, 'Evidence is required to close an action');
export const memberSchema = z.object({ email: z.string().email(), name: z.string().optional(), password: z.string().min(8).optional(), role: z.enum(['ADMIN', 'QA_MANAGER', 'INSPECTOR', 'PRODUCTION', 'VIEWER']) });
