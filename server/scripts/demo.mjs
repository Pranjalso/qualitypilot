// Simulates ~6 weeks of shop-floor quality activity through the REST API and verifies the QMS rules.
// Demo-only: timestamps are back-dated directly in the DB so trends and control charts have history.
// Usage: API=http://localhost:3000 DATABASE_URL=... node scripts/demo.mjs
import fs from 'fs';
import pg from 'pg';

if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const API = process.env.API ?? 'http://localhost:3000';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const tokens = {};
async function as(who) { if (!tokens[who]) tokens[who] = (await call(null, '/api/auth/login', 'POST', { email: `${who}@qms.local`, password: 'Admin@123' })).token; return tokens[who]; }
async function call(tok, path, method = 'GET', body) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${d.error}`); return d;
}
const expectFail = async (p, re, label) => { try { await p; throw new Error('expected failure: ' + label); } catch (e) { if (!re.test(e.message)) throw e; console.log('  ✓ blocked:', label, '—', e.message.split(/→ \d+ /)[1]); } };
const ok = (c, m) => { if (!c) throw new Error('ASSERT ' + m); console.log('  ✓', m); };
let seed = 42; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = (m, s) => { const u = Math.max(rnd(), 1e-9), v = rnd(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const QA = await as('qa'), INS = await as('inspector'), INS2 = await as('inspector2'), PRD = await as('production');
const lk = await call(QA, '/api/lookups');
const P = c => lk.products.find(p => p.code === c).id, S = c => lk.suppliers.find(s => s.code === c).id, I = c => lk.instruments.find(i => i.code === c).id;
const D = c => lk.defects.find(d => d.code === c).id, L = c => lk.lines.find(l => l.code === c).id, U = n => lk.users.find(u => u.name.startsWith(n)).id;

console.log('Control plans');
const plans = {
  DS_IPQC: { product_id: P('DS-200'), stage: 'IPQC', title: 'Drive shaft – CNC turning patrol inspection', sampling_method: 'FIXED', sample_size: 5, accept_number: 0, characteristics: [
    { name: 'Outer diameter Ø25', type: 'VARIABLE', unit: 'mm', nominal: 25.000, lsl: 24.980, usl: 25.020, instrument_type: 'Micrometer', severity: 'CRITICAL', spc: true },
    { name: 'Overall length', type: 'VARIABLE', unit: 'mm', nominal: 150.00, lsl: 149.90, usl: 150.10, instrument_type: 'Vernier caliper', severity: 'MAJOR', spc: true },
    { name: 'Surface roughness Ra', type: 'VARIABLE', unit: 'µm', usl: 0.80, instrument_type: 'Roughness tester', severity: 'MAJOR', samples: 2 },
    { name: 'Chamfer & burr (visual)', type: 'ATTRIBUTE', method: 'Visual, 1x', severity: 'MINOR' }] },
  DS_FQC: { product_id: P('DS-200'), stage: 'FQC', title: 'Drive shaft – final inspection after hardening', sampling_method: 'FIXED', sample_size: 8, accept_number: 0, characteristics: [
    { name: 'Surface hardness', type: 'VARIABLE', unit: 'HRC', nominal: 60, lsl: 58, usl: 62, instrument_type: 'Hardness tester', severity: 'CRITICAL', samples: 3, spc: true },
    { name: 'Runout', type: 'VARIABLE', unit: 'mm', usl: 0.030, instrument_type: 'Dial indicator', severity: 'MAJOR', samples: 5 },
    { name: 'Visual – cracks, dents, rust', type: 'ATTRIBUTE', method: 'Visual under 500 lux', severity: 'MAJOR' }] },
  MB_FQC: { product_id: P('MB-45'), stage: 'FQC', title: 'Mounting bracket – final inspection (AQL 1.0, level II)', sampling_method: 'ISO2859', accept_number: 2,
    notes: 'Ac/Re taken from ISO 2859-1 Table II-A for AQL 1.0', characteristics: [
    { name: 'Hole Ø10 H8', type: 'VARIABLE', unit: 'mm', nominal: 10.020, lsl: 10.000, usl: 10.050, instrument_type: 'Plug gauge / bore gauge', severity: 'MAJOR', samples: 5, spc: true },
    { name: 'Flatness', type: 'VARIABLE', unit: 'mm', usl: 0.05, instrument_type: 'Height gauge', severity: 'MAJOR', samples: 5 },
    { name: 'Zinc plating thickness', type: 'VARIABLE', unit: 'µm', nominal: 10, lsl: 8, usl: 14, instrument_type: 'Coating gauge', severity: 'MAJOR', samples: 5, spc: true },
    { name: 'Visual – burr, dent, plating defects', type: 'ATTRIBUTE', method: 'Visual', severity: 'MINOR' }] },
  RM_IQC: { product_id: P('RM-EN19'), stage: 'IQC', title: 'EN19 bar – incoming inspection', sampling_method: 'FIXED', sample_size: 5, accept_number: 0, characteristics: [
    { name: 'Bar diameter Ø28', type: 'VARIABLE', unit: 'mm', nominal: 28.0, lsl: 27.8, usl: 28.2, instrument_type: 'Micrometer', severity: 'CRITICAL', spc: true },
    { name: 'Mill test certificate verified', type: 'ATTRIBUTE', method: 'Document check', severity: 'MAJOR', samples: 1 },
    { name: 'Surface – rust / seams', type: 'ATTRIBUTE', method: 'Visual', severity: 'MINOR' }] },
};
const plan = {};
for (const [k, v] of Object.entries(plans)) { plan[k] = await call(QA, '/api/plans', 'POST', v); await call(QA, `/api/plans/${plan[k].id}/approve`, 'POST'); }
plan.DS_IPQC = await call(QA, `/api/plans/${plan.DS_IPQC.id}`);  plan.DS_FQC = await call(QA, `/api/plans/${plan.DS_FQC.id}`);
plan.MB_FQC = await call(QA, `/api/plans/${plan.MB_FQC.id}`);    plan.RM_IQC = await call(QA, `/api/plans/${plan.RM_IQC.id}`);
await expectFail(call(INS, '/api/plans', 'POST', plans.RM_IQC), /role/, 'inspector editing a control plan');

const INSTR = { 'Micrometer': ['MIC-01', 'MIC-02'], 'Vernier caliper': ['VC-03'], 'Roughness tester': ['SRT-01'], 'Hardness tester': ['HRC-01'], 'Dial indicator': ['DTI-02'],
  'Plug gauge / bore gauge': ['PG-01'], 'Height gauge': ['VC-03'], 'Coating gauge': ['CT-01'] };
const DEF = { 'Outer diameter Ø25': v => (v > 25.02 ? 'D01' : 'D02'), 'Overall length': () => 'D03', 'Surface roughness Ra': () => 'D04', 'Chamfer & burr (visual)': () => 'D05',
  'Surface hardness': () => 'D07', 'Runout': () => 'D08', 'Visual – cracks, dents, rust': () => 'D10', 'Hole Ø10 H8': () => 'D11', 'Flatness': () => 'D14',
  'Zinc plating thickness': () => 'D09', 'Visual – burr, dent, plating defects': () => 'D06', 'Bar diameter Ø28': v => (v > 28.2 ? 'D01' : 'D02'), 'Mill test certificate verified': () => 'D13', 'Surface – rust / seams': () => 'D10' };

let lotSeq = 0; const stats = { lots: 0, fail: 0 };
async function runLot({ tok, product, stage, qty, daysAgo, line, supplier, gen, woId }) {
  const lot = await call(PRD, '/api/lots', 'POST', { lot_no: `${product}-${day(daysAgo).replace(/-/g, '').slice(2)}-${String(++lotSeq).padStart(3, '0')}`, product_id: P(product), stage,
    source: supplier ? 'SUPPLIER' : 'PRODUCTION', supplier_id: supplier ? S(supplier) : null, line_id: line ? L(line) : null, work_order_id: woId ?? null,
    shift: ['A', 'B', 'C'][lotSeq % 3], quantity: qty, lot_date: day(daysAgo), grn_no: supplier ? `GRN-${lotSeq}` : null, supplier_invoice: supplier ? `INV-${supplier}-${lotSeq}` : null });
  const r = await inspect(tok, lot.id, gen, daysAgo);
  return { lot, ...r };
}
async function inspect(tok, lotId, gen, daysAgo) {
  const { id } = await call(tok, `/api/lots/${lotId}/inspect`, 'POST');
  const insp = await call(tok, `/api/inspections/${id}`);
  const results = [], defects = {};
  for (const ch of insp.characteristics) for (let s = 1; s <= ch.n; s++) {
    const g = gen(ch.name, s);
    const instr = ch.instrument_type ? I(INSTR[ch.instrument_type][s % INSTR[ch.instrument_type].length]) : null;
    if (ch.type === 'VARIABLE') { const v = Math.round(g * 10000) / 10000; results.push({ characteristic_id: ch.id, sample_no: s, value: v, instrument_id: instr });
      if ((ch.usl != null && v > ch.usl) || (ch.lsl != null && v < ch.lsl)) { const k = DEF[ch.name](v); defects[k] = (defects[k] ?? 0) + 1; } }
    else { results.push({ characteristic_id: ch.id, sample_no: s, ok: g, instrument_id: null }); if (!g) { const k = DEF[ch.name](); defects[k] = (defects[k] ?? 0) + 1; } }
  }
  await call(tok, `/api/inspections/${id}/results`, 'PUT', { results });
  for (const [code, q] of Object.entries(defects)) await call(tok, `/api/inspections/${id}/defects`, 'POST', { defect_code_id: D(code), quantity: q, remarks: 'Found during inspection' });
  const sub = await call(tok, `/api/inspections/${id}/submit`, 'POST', { remarks: Object.keys(defects).length ? 'Non-conformities logged' : 'All characteristics within specification' });
  const t = `now() - interval '${daysAgo} days' + interval '${8 + (lotSeq % 9)} hours'`;
  await db.query(`UPDATE inspections SET started_at=${t} - interval '25 minutes', submitted_at=${t} WHERE id=$1`, [id]);
  if (sub.ncr_id) await db.query(`UPDATE ncrs SET raised_at=${t} WHERE id=$1`, [sub.ncr_id]);
  stats.lots++; if (sub.result === 'FAIL') stats.fail++;
  return { inspection_id: id, ...sub };
}

const wo1 = await call(PRD, '/api/work-orders', 'POST', { wo_no: 'WO-26-1101', product_id: P('DS-200'), line_id: L('CNC-1'), planned_qty: 12000, status: 'IN_PROGRESS' });
const wo2 = await call(PRD, '/api/work-orders', 'POST', { wo_no: 'WO-26-1102', product_id: P('DS-200'), line_id: L('CNC-2'), planned_qty: 12000, status: 'IN_PROGRESS' });
const wo3 = await call(PRD, '/api/work-orders', 'POST', { wo_no: 'WO-26-1103', product_id: P('MB-45'), line_id: L('PRS-1'), planned_qty: 40000, status: 'IN_PROGRESS' });

console.log('Rule checks before history');
{ // overdue gauge, incomplete submission, self-approval
  const lot = await call(PRD, '/api/lots', 'POST', { lot_no: 'MB-TEST-001', product_id: P('MB-45'), stage: 'FQC', source: 'PRODUCTION', quantity: 1000, line_id: L('PRS-1') });
  const { id } = await call(INS, `/api/lots/${lot.id}/inspect`, 'POST'); const insp = await call(INS, `/api/inspections/${id}`);
  ok(insp.sample_size === 80, `ISO 2859-1 level II: lot 1000 → code J → sample size ${insp.sample_size}`);
  const flat = insp.characteristics.find(c => c.name === 'Flatness');
  await expectFail(call(INS, `/api/inspections/${id}/results`, 'PUT', { results: [{ characteristic_id: flat.id, sample_no: 1, value: 0.02, instrument_id: I('HG-01') }] }), /calibration expired/, 'measurement with an overdue gauge (HG-01)');
  await expectFail(call(INS, `/api/inspections/${id}/submit`, 'POST', {}), /Incomplete/, 'submitting with missing measurements');
  await db.query(`DELETE FROM inspections WHERE id=$1`, [id]); await db.query(`DELETE FROM lots WHERE id=$1`, [lot.id]);
}
await expectFail(call(PRD, '/api/lots', 'POST', { lot_no: 'X', product_id: P('RM-EN19'), stage: 'IQC', source: 'SUPPLIER', quantity: 10 }), /supplier/i, 'supplier lot without supplier');

console.log('Six weeks of production & incoming lots');
const ncrsBy = { cnc2: [], s03: [], fqc: [], other: [] };
for (let d = 42; d >= 1; d--) {
  const wk = Math.floor((42 - d) / 7);        // 0..5
  const drift = d <= 20 && d >= 12 ? 0.0024 * (21 - d) : 0;     // CNC-2 tool wear: OD creeps up over ~9 days, then tool change
  const ds = (line, mOD) => (name, s) => name.startsWith('Outer') ? gauss(mOD, 0.0042) : name === 'Overall length' ? gauss(150.0, 0.025) : name.startsWith('Surface rough') ? gauss(0.52, 0.07) : rnd() > 0.002;
  for (const [line, wo, base, tok] of [['CNC-1', wo1, 25.001, INS], ['CNC-2', wo2, 25.002 + drift, INS2]]) {
    const r = await runLot({ tok, product: 'DS-200', stage: 'IPQC', qty: 250, daysAgo: d, line, woId: wo.id, gen: ds(line, base) });
    if (r.ncr_id) (line === 'CNC-2' ? ncrsBy.cnc2 : ncrsBy.other).push({ ...r, line });
  }
  if (d % 2 === 0) { const r = await runLot({ tok: INS, product: 'DS-200', stage: 'FQC', qty: 500, daysAgo: d, line: 'HT-1',
      gen: (n) => n === 'Surface hardness' ? gauss(d === 30 ? 57.6 : 60.1, 0.6) : n === 'Runout' ? Math.abs(gauss(0.013, 0.005)) : rnd() > 0.003 });
    if (r.ncr_id) ncrsBy.fqc.push(r); }
  const r = await runLot({ tok: d % 2 ? INS : INS2, product: 'MB-45', stage: 'FQC', qty: 1000, daysAgo: d, line: 'PRS-1', woId: wo3.id,
    gen: (n) => n.startsWith('Hole') ? gauss(10.022, 0.006) : n === 'Flatness' ? Math.abs(gauss(0.018, 0.008)) : n.startsWith('Zinc') ? gauss(wk >= 4 ? 8.9 : 10.4, 0.6) : rnd() > 0.012 });
  if (r.ncr_id) ncrsBy.other.push(r);
  if (d % 7 === 3) for (const sup of ['S01', 'S02', 'S03']) {
    const bad = sup === 'S03' && (wk === 1 || wk === 3);
    const r2 = await runLot({ tok: INS, product: 'RM-EN19', stage: 'IQC', qty: 500, daysAgo: d, supplier: sup,
      gen: (n) => n.startsWith('Bar') ? gauss(bad ? 28.17 : 28.02, 0.05) : n.startsWith('Mill') ? !(sup === 'S03' && wk === 3) : rnd() > 0.02 });
    if (r2.ncr_id) ncrsBy.s03.push({ ...r2, sup });
  }
}
console.log(`  ${stats.lots} inspections, ${stats.fail} failed · NCRs: CNC-2 ${ncrsBy.cnc2.length}, supplier ${ncrsBy.s03.length}, FQC ${ncrsBy.fqc.length}, other ${ncrsBy.other.length}`);

console.log('Material review board (dispositions)');
const n0 = ncrsBy.cnc2[0] ?? ncrsBy.other[0];
await expectFail(call(INS2, `/api/ncrs/${n0.ncr_id}/disposition`, 'POST', { disposition: 'SCRAP', disposition_qty: 1, note: 'scrap it' }), /role/, 'inspector giving a disposition');
const crit = [...ncrsBy.cnc2, ...ncrsBy.fqc, ...ncrsBy.s03].find(n => n.critical_fail);
await expectFail(call(QA, `/api/ncrs/${crit.ncr_id}/disposition`, 'POST', { disposition: 'USE_AS_IS', disposition_qty: 0, note: 'customer will accept' }), /CRITICAL/, 'use-as-is on a CRITICAL non-conformance');
for (const n of ncrsBy.cnc2) {   // oversize OD → rework (regrind) → re-inspect
  await call(QA, `/api/ncrs/${n.ncr_id}/review`, 'POST');
  await call(QA, `/api/ncrs/${n.ncr_id}/disposition`, 'POST', { disposition: 'REWORK', disposition_qty: 250, note: 'Oversize OD – regrind on cylindrical grinder and 100% re-check', cost_of_poor_quality: 3800 });
  const re = await inspect(INS2, n.lot.id, (name) => name.startsWith('Outer') ? gauss(25.004, 0.003) : name === 'Overall length' ? gauss(150, 0.02) : name.startsWith('Surface') ? gauss(0.5, 0.05) : true, 0);
  ok(re.result === 'PASS', `rework lot ${n.lot.lot_no} re-inspected → ${re.result}`);
}
for (const n of ncrsBy.s03) { await call(QA, `/api/ncrs/${n.ncr_id}/disposition`, 'POST', { disposition: 'RETURN_TO_SUPPLIER', disposition_qty: 500, note: 'Bar dia / MTC non-conforming – debit note raised on supplier', cost_of_poor_quality: 1500 }); }
for (const n of [...ncrsBy.fqc, ...ncrsBy.other]) {
  const isHard = ncrsBy.fqc.includes(n);
  await call(QA, `/api/ncrs/${n.ncr_id}/disposition`, 'POST', isHard ? { disposition: 'SORT_100', disposition_qty: 37, note: '100% hardness check; soft parts segregated & scrapped', cost_of_poor_quality: 9250 }
    : { disposition: n.critical_fail ? 'SORT_100' : 'USE_AS_IS', disposition_qty: n.critical_fail ? 12 : 0, note: n.critical_fail ? 'Sorted 100%' : 'Minor cosmetic – concession from customer QA (email ref CQ-118)', cost_of_poor_quality: 600 });
}
await expectFail(call(QA, `/api/ncrs/${crit.ncr_id}/close`, 'POST'), /CAPA/, 'closing a CRITICAL NCR without a CAPA');

console.log('Customer complaint & CAPA (8D)');
const cc = await call(QA, '/api/ncrs', 'POST', { source: 'CUSTOMER_COMPLAINT', customer: 'Tata Motors', product_id: P('MB-45'), severity: 'MAJOR', qty_affected: 120,
  title: 'White rust on brackets at customer line', description: 'Tata Motors Pune reported white rust on 120 brackets from 3 lots; plating thickness found 7.6–8.2 µm.' });
await db.query(`UPDATE ncrs SET raised_at=now() - interval '6 days' WHERE id=$1`, [cc.id]);
const c1 = await call(QA, '/api/capas', 'POST', { title: 'CNC-2 Ø25 oversize due to insert wear', owner_id: U('Ravi'), team: 'Ravi (Prod), Meera (QA), Tool room, Maintenance',
  problem: 'What: OD Ø25 above 25.020 mm on DS-200. Where: CNC-2. When: 9 consecutive days. How many: ' + ncrsBy.cnc2.length + ' lots rejected at IPQC.', target_date: day(-10), ncr_ids: ncrsBy.cnc2.map(n => n.ncr_id) });
await call(QA, `/api/capas/${c1.id}/advance`, 'POST');                       // D1-D2 done → containment step
await expectFail(call(QA, `/api/capas/${c1.id}/advance`, 'POST'), /D3/, 'skipping containment (D3)');
await call(PRD, `/api/capas/${c1.id}`, 'PUT', { containment: 'All CNC-2 lots since last good check quarantined and 100% gauged; insert changed; first-off approval re-done.' });
await call(PRD, `/api/capas/${c1.id}/advance`, 'POST');
await call(PRD, `/api/capas/${c1.id}`, 'PUT', { root_cause_method: '5WHY', whys: ['OD oversize', 'Insert worn beyond limit', 'Insert not changed at planned count', 'No tool-life counter on CNC-2 (manual log missed)', 'Tool-life control not in PFMEA/control plan'],
  root_cause: 'No automatic tool-life monitoring on CNC-2; manual insert change log was missed on night shift.' });
await call(PRD, `/api/capas/${c1.id}/advance`, 'POST');
const a1 = await call(QA, `/api/capas/${c1.id}/actions`, 'POST', { kind: 'CORRECTIVE', description: 'Enable tool-life counter in CNC-2 controller (alarm at 400 pcs)', owner_id: U('Ravi'), due_date: day(5) });
const a2 = await call(QA, `/api/capas/${c1.id}/actions`, 'POST', { kind: 'PREVENTIVE', description: 'Add tool-life control to PFMEA & control plan for all CNC cells; SPC on Ø25 every 2 h', owner_id: U('Sunita'), due_date: day(4) });
await expectFail(call(PRD, `/api/capa-actions/${a1.id}`, 'PUT', { status: 'DONE' }), /Evidence/, 'closing an action without evidence');
await call(PRD, `/api/capa-actions/${a1.id}`, 'PUT', { status: 'DONE', evidence: 'Controller param #6810 set; alarm verified on 3 cycles (photo in file)' });
await expectFail(call(QA, `/api/capas/${c1.id}/advance`, 'POST'), /still open/, 'moving to verification with open actions');
// CAPA 2 — supplier, fully closed
const c2 = await call(QA, '/api/capas', 'POST', { title: 'Metro Bar EN19 diameter & MTC non-conformance', owner_id: U('Sunita'), problem: 'Two IQC rejections from S03: Ø28 oversize and missing mill certificates.', target_date: day(3), ncr_ids: ncrsBy.s03.map(n => n.ncr_id) });
await call(QA, `/api/capas/${c2.id}/advance`, 'POST'); await call(QA, `/api/capas/${c2.id}`, 'PUT', { containment: 'S03 put on CONDITIONAL status; 100% IQC for next 5 lots.' });
await call(QA, `/api/capas/${c2.id}/advance`, 'POST');
await call(QA, `/api/capas/${c2.id}`, 'PUT', { root_cause_method: 'FISHBONE', fishbone: { Method: 'Supplier sorts bars by eye', Measurement: 'Supplier micrometer not calibrated', Material: 'Mixed heat numbers', Man: 'New dispatch staff' }, root_cause: 'Supplier had no outgoing inspection and an uncalibrated micrometer.' });
await call(QA, `/api/capas/${c2.id}/advance`, 'POST');
const a3 = await call(QA, `/api/capas/${c2.id}/actions`, 'POST', { kind: 'CORRECTIVE', description: 'Supplier to implement PDI with calibrated gauge and send PDI report with every lot', owner_id: U('Sunita'), due_date: day(10) });
await call(QA, `/api/capa-actions/${a3.id}`, 'PUT', { status: 'DONE', evidence: 'Supplier PDI format & calibration cert received; audit done 20-Oct' });
await call(QA, `/api/capas/${c2.id}/advance`, 'POST');
await expectFail(call(QA, `/api/capas/${c2.id}/advance`, 'POST'), /D7/, 'closing CAPA without verification of effectiveness');
await call(QA, `/api/capas/${c2.id}`, 'PUT', { verification: 'Next 4 lots from S03 accepted at IQC with PDI reports', effective: true, lessons: 'Add PDI report requirement to all raw-material POs' });
await call(QA, `/api/capas/${c2.id}/advance`, 'POST');
for (const n of ncrsBy.s03) await call(QA, `/api/ncrs/${n.ncr_id}/close`, 'POST');
const c3 = await call(QA, '/api/capas', 'POST', { title: 'Zinc plating thickness low – white rust complaint', owner_id: U('Ravi'), problem: 'Customer complaint + FQC trend: plating thickness drifting to ~9 µm (LSL 8).', target_date: day(-20), ncr_ids: [cc.id] });
// close non-critical NCRs that don't need CAPA
for (const n of ncrsBy.other.filter(n => !n.critical_fail)) await call(QA, `/api/ncrs/${n.ncr_id}/close`, 'POST').catch(e => console.log('   (kept open)', e.message.split('→ ')[1]));

console.log('Calibration');
await call(QA, `/api/instruments/${I('SRT-01')}/calibrations`, 'POST', { calibrated_on: day(1), agency: 'NABL Lab – Calibtech Indore', certificate_no: 'CT/SRT-01/26', result: 'PASS' });

console.log('Results');
const ch = plan.DS_IPQC.characteristics.find(c => c.name.startsWith('Outer'));
const s = await call(QA, `/api/spc/${ch.id}`);
console.log(`  SPC Ø25: ${s.stats.subgroups} subgroups, X̄̄=${s.limits.center}, UCL=${s.limits.ucl}, LCL=${s.limits.lcl}, Cp=${s.stats.cp}, Cpk=${s.stats.cpk}, signals=${s.stats.signals}`);
ok(s.stats.signals > 0, 'control chart flags the CNC-2 drift');
const pl = await call(QA, `/api/spc/${plan.MB_FQC.characteristics.find(c => c.name.startsWith('Zinc')).id}`);
console.log(`  SPC plating: Cpk=${pl.stats.cpk} (${pl.stats.verdict}), signals=${pl.stats.signals}`);
const dash = await call(QA, '/api/reports/dashboard');
console.log(`  FPY ${dash.fpy}% · sample PPM ${dash.ppm_sample} · open NCRs ${dash.ncrs.open} · open CAPAs ${dash.capas.open} · overdue actions ${dash.capas.overdue_actions} · COPQ90 ₹${dash.ncrs.copq_90d}`);
console.log('  Pareto:', dash.pareto.slice(0, 4).map(p => `${p.code} ${p.qty} (${p.cum_pct}%)`).join(' · '));
const sq = await call(QA, '/api/reports/suppliers'); console.log('  Supplier PPM:', sq.map(x => `${x.code} ${x.ppm}`).join(' · '));
ok(sq.find(x => x.code === 'S03').ppm > 0, 'supplier PPM reflects returned lots');
await db.end(); console.log('DONE');
