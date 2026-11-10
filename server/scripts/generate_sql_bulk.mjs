import fs from 'fs';

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = (m, s) => { const u = Math.max(rnd(), 1e-9), v = rnd(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const base = new Date('2026-11-01T12:00:00Z');
const day = n => { const d = new Date(base); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

const INSTR_MAP = {
  'Micrometer': [1, 2], 'Vernier caliper': [3], 'Roughness tester': [4], 'Hardness tester': [5], 'Dial indicator': [6],
  'Plug gauge / bore gauge': [7], 'Height gauge': [3], 'Coating gauge': [8]
};
const DEF_MAP = {
  'Outer diameter Ø25': v => (v > 25.02 ? 1 : 2), 'Overall length': () => 3, 'Surface roughness Ra': () => 4, 'Chamfer & burr (visual)': () => 5,
  'Surface hardness': () => 7, 'Runout': () => 8, 'Visual – cracks, dents, rust': () => 10, 'Hole Ø10 H8': () => 11, 'Flatness': () => 14,
  'Zinc plating thickness': () => 9, 'Visual – burr, dent, plating defects': () => 6, 'Bar diameter Ø28': v => (v > 28.2 ? 1 : 2), 'Mill test certificate verified': () => 13, 'Surface – rust / seams': () => 10
};

const lines = [];
lines.push(`BEGIN;`);
lines.push(`DELETE FROM capa_actions;`);
lines.push(`DELETE FROM ncrs;`);
lines.push(`DELETE FROM capas;`);
lines.push(`DELETE FROM inspection_defects;`);
lines.push(`DELETE FROM inspection_results;`);
lines.push(`DELETE FROM inspections;`);
lines.push(`DELETE FROM lots;`);
lines.push(`DELETE FROM work_orders;`);
lines.push(`DELETE FROM plan_characteristics;`);
lines.push(`DELETE FROM inspection_plans;`);

// Create plans
lines.push(`
INSERT INTO inspection_plans(id, org_id, plan_no, product_id, stage, version, title, sampling_method, sample_size, accept_number, notes, active, approved_by, approved_at) VALUES
(1, 1, 'CP-DS-200-IPQC', 1, 'IPQC', 1, 'Drive shaft – CNC turning patrol inspection', 'FIXED', 5, 0, NULL, true, 2, '2026-09-01 10:00:00Z'),
(2, 1, 'CP-DS-200-FQC', 1, 'FQC', 1, 'Drive shaft – final inspection after hardening', 'FIXED', 8, 0, NULL, true, 2, '2026-09-01 10:00:00Z'),
(3, 1, 'CP-MB-45-FQC', 2, 'FQC', 1, 'Mounting bracket – final inspection (AQL 1.0, level II)', 'ISO2859', 80, 2, 'Ac/Re taken from ISO 2859-1 Table II-A for AQL 1.0', true, 2, '2026-09-01 10:00:00Z'),
(4, 1, 'CP-RM-EN19-IQC', 3, 'IQC', 1, 'EN19 bar – incoming inspection', 'FIXED', 5, 0, NULL, true, 2, '2026-09-01 10:00:00Z');
`);

lines.push(`
INSERT INTO plan_characteristics(id, plan_id, seq, name, type, unit, nominal, lsl, usl, instrument_type, method, severity, samples, spc) VALUES
(1, 1, 10, 'Outer diameter Ø25', 'VARIABLE', 'mm', 25.000, 24.980, 25.020, 'Micrometer', NULL, 'CRITICAL', 5, true),
(2, 1, 20, 'Overall length', 'VARIABLE', 'mm', 150.00, 149.90, 150.10, 'Vernier caliper', NULL, 'MAJOR', 5, true),
(3, 1, 30, 'Surface roughness Ra', 'VARIABLE', 'µm', NULL, NULL, 0.80, 'Roughness tester', NULL, 'MAJOR', 2, false),
(4, 1, 40, 'Chamfer & burr (visual)', 'ATTRIBUTE', NULL, NULL, NULL, NULL, NULL, 'Visual, 1x', 'MINOR', 5, false),

(5, 2, 10, 'Surface hardness', 'VARIABLE', 'HRC', 60, 58, 62, 'Hardness tester', NULL, 'CRITICAL', 3, true),
(6, 2, 20, 'Runout', 'VARIABLE', 'mm', NULL, NULL, 0.030, 'Dial indicator', NULL, 'MAJOR', 5, false),
(7, 2, 30, 'Visual – cracks, dents, rust', 'ATTRIBUTE', NULL, NULL, NULL, NULL, NULL, 'Visual under 500 lux', 'MAJOR', 8, false),

(8, 3, 10, 'Hole Ø10 H8', 'VARIABLE', 'mm', 10.020, 10.000, 10.050, 'Plug gauge / bore gauge', NULL, 'MAJOR', 5, true),
(9, 3, 20, 'Flatness', 'VARIABLE', 'mm', NULL, NULL, 0.05, 'Height gauge', NULL, 'MAJOR', 5, false),
(10, 3, 30, 'Zinc plating thickness', 'VARIABLE', 'µm', 10, 8, 14, 'Coating gauge', NULL, 'MAJOR', 5, true),
(11, 3, 40, 'Visual – burr, dent, plating defects', 'ATTRIBUTE', NULL, NULL, NULL, NULL, NULL, 'Visual', 'MINOR', 80, false),

(12, 4, 10, 'Bar diameter Ø28', 'VARIABLE', 'mm', 28.0, 27.8, 28.2, 'Micrometer', NULL, 'CRITICAL', 5, true),
(13, 4, 20, 'Mill test certificate verified', 'ATTRIBUTE', NULL, NULL, NULL, NULL, NULL, 'Document check', 'MAJOR', 1, false),
(14, 4, 30, 'Surface – rust / seams', 'ATTRIBUTE', NULL, NULL, NULL, NULL, NULL, 'Visual', 'MINOR', 5, false);
`);

lines.push(`
INSERT INTO work_orders(id, org_id, wo_no, product_id, line_id, planned_qty, status) VALUES
(1, 1, 'WO-26-1101', 1, 1, 12000, 'IN_PROGRESS'),
(2, 1, 'WO-26-1102', 1, 2, 12000, 'IN_PROGRESS'),
(3, 1, 'WO-26-1103', 2, 3, 40000, 'IN_PROGRESS');
`);

const planChars = {
  'DS_IPQC': [
    { id: 1, name: 'Outer diameter Ø25', type: 'VARIABLE', lsl: 24.980, usl: 25.020, instrument_type: 'Micrometer', severity: 'CRITICAL', n: 5 },
    { id: 2, name: 'Overall length', type: 'VARIABLE', lsl: 149.90, usl: 150.10, instrument_type: 'Vernier caliper', severity: 'MAJOR', n: 5 },
    { id: 3, name: 'Surface roughness Ra', type: 'VARIABLE', lsl: null, usl: 0.80, instrument_type: 'Roughness tester', severity: 'MAJOR', n: 2 },
    { id: 4, name: 'Chamfer & burr (visual)', type: 'ATTRIBUTE', severity: 'MINOR', n: 5 }
  ],
  'DS_FQC': [
    { id: 5, name: 'Surface hardness', type: 'VARIABLE', lsl: 58, usl: 62, instrument_type: 'Hardness tester', severity: 'CRITICAL', n: 3 },
    { id: 6, name: 'Runout', type: 'VARIABLE', lsl: null, usl: 0.030, instrument_type: 'Dial indicator', severity: 'MAJOR', n: 5 },
    { id: 7, name: 'Visual – cracks, dents, rust', type: 'ATTRIBUTE', severity: 'MAJOR', n: 8 }
  ],
  'MB_FQC': [
    { id: 8, name: 'Hole Ø10 H8', type: 'VARIABLE', lsl: 10.000, usl: 10.050, instrument_type: 'Plug gauge / bore gauge', severity: 'MAJOR', n: 5 },
    { id: 9, name: 'Flatness', type: 'VARIABLE', lsl: null, usl: 0.05, instrument_type: 'Height gauge', severity: 'MAJOR', n: 5 },
    { id: 10, name: 'Zinc plating thickness', type: 'VARIABLE', lsl: 8, usl: 14, instrument_type: 'Coating gauge', severity: 'MAJOR', n: 5 },
    { id: 11, name: 'Visual – burr, dent, plating defects', type: 'ATTRIBUTE', severity: 'MINOR', n: 80 }
  ],
  'RM_IQC': [
    { id: 12, name: 'Bar diameter Ø28', type: 'VARIABLE', lsl: 27.8, usl: 28.2, instrument_type: 'Micrometer', severity: 'CRITICAL', n: 5 },
    { id: 13, name: 'Mill test certificate verified', type: 'ATTRIBUTE', severity: 'MAJOR', n: 1 },
    { id: 14, name: 'Surface – rust / seams', type: 'ATTRIBUTE', severity: 'MINOR', n: 5 }
  ]
};

let lotSeq = 0, inspSeq = 0, ncrSeq = 0;
const lotRows = [];
const inspRows = [];
const resRows = [];
const defRows = [];
const ncrRows = [];

const ncrsBy = { cnc2: [], s03: [], fqc: [], other: [] };

function simulateLot({ productCode, pId, planId, planKey, stage, qty, daysAgo, lineId, supId, woId, inspectorId, gen }) {
  lotSeq++;
  const lotDate = day(daysAgo);
  const lotNo = `${productCode}-${lotDate.replace(/-/g, '').slice(2)}-${String(lotSeq).padStart(3, '0')}`;
  const shift = ['A', 'B', 'C'][lotSeq % 3];
  const grn = supId ? `'GRN-${lotSeq}'` : 'NULL';
  const inv = supId ? `'INV-${supId}-${lotSeq}'` : 'NULL';
  const currentLotId = lotSeq;

  inspSeq++;
  const currentInspId = inspSeq;
  const inspNo = `${stage}-2026-${String(inspSeq).padStart(4, '0')}`;
  const sampleSize = planKey === 'MB_FQC' ? 80 : (planKey === 'DS_FQC' ? 8 : 5);
  const ac = planKey === 'MB_FQC' ? 2 : 0;
  // Fixed timestamp relative to 2026-11-01 12:00:00Z
  const inspTime = `('2026-11-01 12:00:00Z'::timestamptz - interval '${daysAgo} days' + interval '${8 + (lotSeq % 9)} hours')`;

  const chars = planChars[planKey];
  let anyCriticalNG = false;
  const defectiveUnits = new Set();
  const defectiveChars = new Set();

  for (const ch of chars) {
    for (let s = 1; s <= ch.n; s++) {
      const g = gen(ch.name, s);
      const instrList = ch.instrument_type ? INSTR_MAP[ch.instrument_type] : null;
      const instrId = instrList ? instrList[s % instrList.length] : 'NULL';
      let okVal = true;
      let valNum = 'NULL';

      if (ch.type === 'VARIABLE') {
        const v = Math.round(g * 10000) / 10000;
        valNum = v;
        if ((ch.usl != null && v > ch.usl) || (ch.lsl != null && v < ch.lsl)) {
          okVal = false;
          const defId = DEF_MAP[ch.name](v);
          defRows.push(`(${currentInspId}, ${defId}, 1, 'Found during inspection')`);
          defectiveUnits.add(s);
          defectiveChars.add(ch.name);
          if (ch.severity === 'CRITICAL') anyCriticalNG = true;
        }
      } else {
        okVal = !!g;
        if (!okVal) {
          const defId = DEF_MAP[ch.name]();
          defRows.push(`(${currentInspId}, ${defId}, 1, 'Found during inspection')`);
          defectiveUnits.add(s);
          defectiveChars.add(ch.name);
          if (ch.severity === 'CRITICAL') anyCriticalNG = true;
        }
      }
      resRows.push(`(${currentInspId}, ${ch.id}, ${s}, ${valNum}, ${okVal}, ${instrId}, ${inspTime})`);
    }
  }

  const failed = anyCriticalNG || defectiveUnits.size > ac;
  const lotStatus = failed ? 'ON_HOLD' : 'ACCEPTED';
  const inspResult = failed ? 'FAIL' : 'PASS';
  const accQty = failed ? 0 : qty;
  const rejQty = 0;

  lotRows.push(`(${currentLotId}, 1, '${lotNo}', ${pId}, '${supId ? 'SUPPLIER' : 'PRODUCTION'}', ${supId ?? 'NULL'}, ${lineId ?? 'NULL'}, ${woId ?? 'NULL'}, '${shift}', '${stage}', ${qty}, '${lotDate}', ${grn}, ${inv}, '${lotStatus}', ${accQty}, ${rejQty}, 5)`);

  inspRows.push(`(${currentInspId}, 1, '${inspNo}', ${currentLotId}, ${planId}, '${stage}', ${sampleSize}, ${ac}, ${inspectorId}, ${inspTime} - interval '25 minutes', ${inspTime}, 'DRAFT', '${inspResult}', ${defectiveUnits.size}, ${anyCriticalNG})`);

  let ncrId = null;
  if (failed) {
    ncrSeq++;
    ncrId = ncrSeq;
    const ncrNo = `NCR-2026-${String(ncrSeq).padStart(4, '0')}`;
    const severity = anyCriticalNG ? 'CRITICAL' : 'MAJOR';
    const title = defectiveChars.size ? `${stage} reject: ${Array.from(defectiveChars).join(', ')}` : `${stage} reject: non-conforming parameters`;
    const desc = `Lot ${lotNo} failed ${stage} inspection: ${defectiveUnits.size} defective of ${sampleSize} sampled (Ac ${ac}).`;

    ncrRows.push(`(${ncrId}, 1, '${ncrNo}', '${supId ? 'SUPPLIER' : 'INSPECTION'}', ${currentInspId}, ${currentLotId}, ${pId}, ${supId ?? 'NULL'}, '${title}', '${desc}', ${qty}, '${severity}', ${inspectorId}, ${inspTime}, 'OPEN')`);
  }

  return { lotId: currentLotId, lotNo, inspectionId: currentInspId, ncrId, failed, anyCriticalNG };
}

for (let d = 42; d >= 1; d--) {
  const wk = Math.floor((42 - d) / 7);
  const drift = d <= 20 && d >= 12 ? 0.0024 * (21 - d) : 0;
  const ds = (line, mOD) => (name, s) => name.startsWith('Outer') ? gauss(mOD, 0.0042) : name === 'Overall length' ? gauss(150.0, 0.025) : name.startsWith('Surface rough') ? gauss(0.52, 0.07) : rnd() > 0.002;

  // CNC-1
  const r1 = simulateLot({ productCode: 'DS-200', pId: 1, planId: 1, planKey: 'DS_IPQC', stage: 'IPQC', qty: 250, daysAgo: d, lineId: 1, woId: 1, inspectorId: 3, gen: ds('CNC-1', 25.001) });
  if (r1.ncrId) ncrsBy.other.push(r1);

  // CNC-2
  const r2 = simulateLot({ productCode: 'DS-200', pId: 1, planId: 1, planKey: 'DS_IPQC', stage: 'IPQC', qty: 250, daysAgo: d, lineId: 2, woId: 2, inspectorId: 4, gen: ds('CNC-2', 25.002 + drift) });
  if (r2.ncrId) ncrsBy.cnc2.push(r2);

  // FQC DS-200
  if (d % 2 === 0) {
    const rf = simulateLot({ productCode: 'DS-200', pId: 1, planId: 2, planKey: 'DS_FQC', stage: 'FQC', qty: 500, daysAgo: d, lineId: 4, inspectorId: 3, gen: (n) => n === 'Surface hardness' ? gauss(d === 30 ? 57.6 : 60.1, 0.6) : n === 'Runout' ? Math.abs(gauss(0.013, 0.005)) : rnd() > 0.003 });
    if (rf.ncrId) ncrsBy.fqc.push(rf);
  }

  // FQC MB-45
  const rm = simulateLot({ productCode: 'MB-45', pId: 2, planId: 3, planKey: 'MB_FQC', stage: 'FQC', qty: 1000, daysAgo: d, lineId: 3, woId: 3, inspectorId: d % 2 ? 3 : 4, gen: (n) => n.startsWith('Hole') ? gauss(10.022, 0.006) : n === 'Flatness' ? Math.abs(gauss(0.018, 0.008)) : n.startsWith('Zinc') ? gauss(wk >= 4 ? 8.9 : 10.4, 0.6) : rnd() > 0.012 });
  if (rm.ncrId) ncrsBy.other.push(rm);

  // Supplier IQC
  if (d % 7 === 3) {
    const supList = [{ s: 1, code: 'S01' }, { s: 2, code: 'S02' }, { s: 3, code: 'S03' }];
    for (const sup of supList) {
      const bad = sup.code === 'S03' && (wk === 1 || wk === 3);
      const rs = simulateLot({ productCode: 'RM-EN19', pId: 3, planId: 4, planKey: 'RM_IQC', stage: 'IQC', qty: 500, daysAgo: d, supId: sup.s, inspectorId: 3, gen: (n) => n.startsWith('Bar') ? gauss(bad ? 28.17 : 28.02, 0.05) : n.startsWith('Mill') ? !(sup.code === 'S03' && wk === 3) : rnd() > 0.02 });
      if (rs.ncrId) ncrsBy.s03.push(rs);
    }
  }
}

// Write Bulk INSERTS
lines.push(`INSERT INTO lots(id, org_id, lot_no, product_id, source, supplier_id, line_id, work_order_id, shift, stage, quantity, lot_date, grn_no, supplier_invoice, status, accepted_qty, rejected_qty, created_by) VALUES\n` + lotRows.join(',\n') + ';');

lines.push(`INSERT INTO inspections(id, org_id, insp_no, lot_id, plan_id, stage, sample_size, accept_number, inspector_id, started_at, submitted_at, status, result, defective_units, critical_fail) VALUES\n` + inspRows.join(',\n') + ';');

// Chunk results in 1000s
for (let i = 0; i < resRows.length; i += 1000) {
  lines.push(`INSERT INTO inspection_results(inspection_id, characteristic_id, sample_no, value, ok, instrument_id, measured_at) VALUES\n` + resRows.slice(i, i + 1000).join(',\n') + ';');
}

if (defRows.length) {
  lines.push(`INSERT INTO inspection_defects(inspection_id, defect_code_id, quantity, remarks) VALUES\n` + defRows.join(',\n') + ';');
}

lines.push(`UPDATE inspections SET status='SUBMITTED';`);

if (ncrRows.length) {
  lines.push(`INSERT INTO ncrs(id, org_id, ncr_no, source, inspection_id, lot_id, product_id, supplier_id, title, description, qty_affected, severity, raised_by, raised_at, status) VALUES\n` + ncrRows.join(',\n') + ';');
}

// Dispositions & CAPAs
for (const n of ncrsBy.cnc2) {
  lines.push(`UPDATE ncrs SET status='DISPOSITIONED', disposition='REWORK', disposition_qty=250, disposition_note='Oversize OD – regrind on cylindrical grinder and 100% re-check', cost_of_poor_quality=3800, disposed_by=2, disposed_at='2026-10-22 14:00:00Z' WHERE id=${n.ncrId};`);
  lines.push(`UPDATE lots SET status='ACCEPTED', accepted_qty=250, rejected_qty=0 WHERE id=${n.lotId};`);
}
for (const n of ncrsBy.s03) {
  lines.push(`UPDATE ncrs SET status='DISPOSITIONED', disposition='RETURN_TO_SUPPLIER', disposition_qty=500, disposition_note='Bar dia / MTC non-conforming – debit note raised on supplier', cost_of_poor_quality=1500, disposed_by=2, disposed_at='2026-10-24 16:00:00Z' WHERE id=${n.ncrId};`);
  lines.push(`UPDATE lots SET status='REJECTED', accepted_qty=0, rejected_qty=500 WHERE id=${n.lotId};`);
}
for (const n of [...ncrsBy.fqc, ...ncrsBy.other]) {
  const isHard = ncrsBy.fqc.includes(n);
  const disp = isHard ? 'SORT_100' : (n.anyCriticalNG ? 'SORT_100' : 'USE_AS_IS');
  const dQty = isHard ? 37 : (n.anyCriticalNG ? 12 : 0);
  const cost = isHard ? 9250 : 600;
  lines.push(`UPDATE ncrs SET status='DISPOSITIONED', disposition='${disp}', disposition_qty=${dQty}, disposition_note='MRB disposition completed', cost_of_poor_quality=${cost}, disposed_by=2, disposed_at='2026-10-27 11:00:00Z' WHERE id=${n.ncrId};`);
  lines.push(`UPDATE lots SET status='CONDITIONAL', accepted_qty=quantity-${dQty}, rejected_qty=${dQty} WHERE id=${n.lotId};`);
}

// Customer complaint NCR-2026-0014
lines.push(`
INSERT INTO ncrs(id, org_id, ncr_no, source, customer, product_id, severity, qty_affected, title, description, raised_by, raised_at, status) VALUES
(14, 1, 'NCR-2026-0014', 'CUSTOMER_COMPLAINT', 'Tata Motors', 2, 'MAJOR', 120, 'White rust on brackets at customer line', 'Tata Motors Pune reported white rust on 120 brackets from 3 lots; plating thickness found 7.6–8.2 µm.', 2, '2026-10-26 15:30:00Z', 'OPEN');
`);

// CAPA 1
lines.push(`
INSERT INTO capas(id, org_id, capa_no, title, owner_id, team, problem, target_date, created_by, status, containment, root_cause_method, whys, root_cause) VALUES
(1, 1, 'CAPA-2026-0001', 'CNC-2 Ø25 oversize due to insert wear', 5, 'Ravi (Prod), Meera (QA), Tool room, Maintenance',
 'What: OD Ø25 above 25.020 mm on DS-200. Where: CNC-2. When: 9 consecutive days.', CURRENT_DATE + 15, 2, 'ACTIONS',
 'All CNC-2 lots since last good check quarantined and 100% gauged; insert changed; first-off approval re-done.',
 '5WHY', '["OD oversize", "Insert worn beyond limit", "Insert not changed at planned count", "No tool-life counter on CNC-2 (manual log missed)", "Tool-life control not in PFMEA/control plan"]'::jsonb,
 'No automatic tool-life monitoring on CNC-2; manual insert change log was missed on night shift.');
`);
for (const n of ncrsBy.cnc2) lines.push(`UPDATE ncrs SET capa_id=1 WHERE id=${n.ncrId};`);

// CAPA 1 actions (1 overdue action)
lines.push(`
INSERT INTO capa_actions(id, capa_id, kind, description, owner_id, due_date, status, completed_on, evidence) VALUES
(1, 1, 'CORRECTIVE', 'Enable tool-life counter in CNC-2 controller (alarm at 400 pcs)', 5, CURRENT_DATE + 5, 'DONE', CURRENT_DATE - 2, 'Controller param #6810 set; alarm verified on 3 cycles'),
(2, 1, 'PREVENTIVE', 'Add tool-life control to PFMEA & control plan for all CNC cells; SPC on Ø25 every 2 h', 2, CURRENT_DATE - 2, 'OPEN', NULL, NULL);
`);

// CAPA 2 (closed)
lines.push(`
INSERT INTO capas(id, org_id, capa_no, title, owner_id, problem, target_date, created_by, status, containment, root_cause_method, root_cause, verification, effective, closed_by, closed_at) VALUES
(2, 1, 'CAPA-2026-0002', 'Metro Bar EN19 diameter & MTC non-conformance', 2, 'Two IQC rejections from S03: Ø28 oversize and missing mill certificates.', CURRENT_DATE + 20, 2, 'CLOSED',
 'S03 put on CONDITIONAL status; 100% IQC for next 5 lots.', 'FISHBONE', 'Supplier had no outgoing inspection and an uncalibrated micrometer.',
 'Next 4 lots from S03 accepted at IQC with PDI reports', true, 2, '2026-10-31 16:00:00Z');
`);
for (const n of ncrsBy.s03) lines.push(`UPDATE ncrs SET capa_id=2, status='CLOSED', closed_by=2, closed_at='2026-10-31 16:00:00Z' WHERE id=${n.ncrId};`);

// CAPA 3
lines.push(`
INSERT INTO capas(id, org_id, capa_no, title, owner_id, problem, target_date, created_by, status) VALUES
(3, 1, 'CAPA-2026-0003', 'Zinc plating thickness low – white rust complaint', 5, 'Customer complaint + FQC trend: plating thickness drifting to ~9 µm (LSL 8).', CURRENT_DATE + 30, 2, 'OPEN');
UPDATE ncrs SET capa_id=3 WHERE id=14;
`);

// Reset sequences
lines.push(`
SELECT setval('lots_id_seq', (SELECT max(id) FROM lots));
SELECT setval('inspections_id_seq', (SELECT max(id) FROM inspections));
SELECT setval('inspection_results_id_seq', (SELECT max(id) FROM inspection_results));
SELECT setval('inspection_defects_id_seq', COALESCE((SELECT max(id) FROM inspection_defects), 1));
SELECT setval('ncrs_id_seq', (SELECT max(id) FROM ncrs));
SELECT setval('capas_id_seq', 3);
SELECT setval('capa_actions_id_seq', 2);
SELECT setval('work_orders_id_seq', 3);
SELECT setval('inspection_plans_id_seq', 4);
SELECT setval('plan_characteristics_id_seq', 14);
`);

lines.push(`
UPDATE instruments SET next_due = CURRENT_DATE + 45 WHERE code = 'SRT-01';
UPDATE instruments SET next_due = CURRENT_DATE - 35 WHERE code = 'HG-01';
`);

lines.push(`COMMIT;`);

fs.writeFileSync(new URL('bulk_seed.sql', import.meta.url), lines.join('\n'));
console.log(`Generated bulk SQL file with ${lotRows.length} lots, ${inspRows.length} inspections, ${resRows.length} results, ${defRows.length} defects!`);
