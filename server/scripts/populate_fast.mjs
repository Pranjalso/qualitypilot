import fs from 'fs';
import pg from 'pg';

if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  console.log("Connected to DB, running fast direct population...");
  try {
    // 1. Clean operational data
    await client.query(`
      DELETE FROM inspection_defects;
      DELETE FROM inspection_results;
      DELETE FROM inspections;
      DELETE FROM capa_actions;
      DELETE FROM ncrs;
      DELETE FROM capas;
      DELETE FROM lots;
      DELETE FROM work_orders;
      DELETE FROM plan_characteristics;
      DELETE FROM inspection_plans;
    `);
    console.log("Cleaned tables.");

    // 2. Fetch lookups
    const orgId = 1;
    const users = (await client.query(`SELECT id, email, name FROM users`)).rows;
    const prods = (await client.query(`SELECT id, code FROM products WHERE org_id=$1`, [orgId])).rows;
    const sups = (await client.query(`SELECT id, code FROM suppliers WHERE org_id=$1`, [orgId])).rows;
    const lines = (await client.query(`SELECT id, code FROM production_lines`)).rows;
    const defs = (await client.query(`SELECT id, code FROM defect_codes WHERE org_id=$1`, [orgId])).rows;
    const insts = (await client.query(`SELECT id, code FROM instruments WHERE org_id=$1`, [orgId])).rows;

    const P = c => prods.find(p => p.code === c).id;
    const S = c => sups.find(s => s.code === c).id;
    const L = c => lines.find(l => l.code === c).id;
    const D = c => defs.find(d => d.code === c).id;
    const I = c => insts.find(i => i.code === c).id;
    const U = n => users.find(u => u.email.startsWith(n)).id;

    // 3. Create Plans
    const plansDef = [
      {
        plan_no: 'CP-DS-200-IPQC', product_id: P('DS-200'), stage: 'IPQC', title: 'Drive shaft – CNC turning patrol inspection',
        sampling_method: 'FIXED', sample_size: 5, accept_number: 0,
        chars: [
          { name: 'Outer diameter Ø25', type: 'VARIABLE', unit: 'mm', nominal: 25.000, lsl: 24.980, usl: 25.020, instrument_type: 'Micrometer', severity: 'CRITICAL', spc: true, n: 5 },
          { name: 'Overall length', type: 'VARIABLE', unit: 'mm', nominal: 150.00, lsl: 149.90, usl: 150.10, instrument_type: 'Vernier caliper', severity: 'MAJOR', spc: true, n: 5 },
          { name: 'Surface roughness Ra', type: 'VARIABLE', unit: 'µm', nominal: null, lsl: null, usl: 0.80, instrument_type: 'Roughness tester', severity: 'MAJOR', spc: false, n: 2 },
          { name: 'Chamfer & burr (visual)', type: 'ATTRIBUTE', unit: null, nominal: null, lsl: null, usl: null, instrument_type: null, severity: 'MINOR', spc: false, n: 5, method: 'Visual, 1x' }
        ]
      },
      {
        plan_no: 'CP-DS-200-FQC', product_id: P('DS-200'), stage: 'FQC', title: 'Drive shaft – final inspection after hardening',
        sampling_method: 'FIXED', sample_size: 8, accept_number: 0,
        chars: [
          { name: 'Surface hardness', type: 'VARIABLE', unit: 'HRC', nominal: 60, lsl: 58, usl: 62, instrument_type: 'Hardness tester', severity: 'CRITICAL', spc: true, n: 3 },
          { name: 'Runout', type: 'VARIABLE', unit: 'mm', nominal: null, lsl: null, usl: 0.030, instrument_type: 'Dial indicator', severity: 'MAJOR', spc: false, n: 5 },
          { name: 'Visual – cracks, dents, rust', type: 'ATTRIBUTE', unit: null, nominal: null, lsl: null, usl: null, instrument_type: null, severity: 'MAJOR', spc: false, n: 8, method: 'Visual under 500 lux' }
        ]
      },
      {
        plan_no: 'CP-MB-45-FQC', product_id: P('MB-45'), stage: 'FQC', title: 'Mounting bracket – final inspection (AQL 1.0, level II)',
        sampling_method: 'ISO2859', sample_size: 80, accept_number: 2, notes: 'Ac/Re taken from ISO 2859-1 Table II-A for AQL 1.0',
        chars: [
          { name: 'Hole Ø10 H8', type: 'VARIABLE', unit: 'mm', nominal: 10.020, lsl: 10.000, usl: 10.050, instrument_type: 'Plug gauge / bore gauge', severity: 'MAJOR', spc: true, n: 5 },
          { name: 'Flatness', type: 'VARIABLE', unit: 'mm', nominal: null, lsl: null, usl: 0.05, instrument_type: 'Height gauge', severity: 'MAJOR', spc: false, n: 5 },
          { name: 'Zinc plating thickness', type: 'VARIABLE', unit: 'µm', nominal: 10, lsl: 8, usl: 14, instrument_type: 'Coating gauge', severity: 'MAJOR', spc: true, n: 5 },
          { name: 'Visual – burr, dent, plating defects', type: 'ATTRIBUTE', unit: null, nominal: null, lsl: null, usl: null, instrument_type: null, severity: 'MINOR', spc: false, n: 80, method: 'Visual' }
        ]
      },
      {
        plan_no: 'CP-RM-EN19-IQC', product_id: P('RM-EN19'), stage: 'IQC', title: 'EN19 bar – incoming inspection',
        sampling_method: 'FIXED', sample_size: 5, accept_number: 0,
        chars: [
          { name: 'Bar diameter Ø28', type: 'VARIABLE', unit: 'mm', nominal: 28.0, lsl: 27.8, usl: 28.2, instrument_type: 'Micrometer', severity: 'CRITICAL', spc: true, n: 5 },
          { name: 'Mill test certificate verified', type: 'ATTRIBUTE', unit: null, nominal: null, lsl: null, usl: null, instrument_type: null, severity: 'MAJOR', spc: false, n: 1, method: 'Document check' },
          { name: 'Surface – rust / seams', type: 'ATTRIBUTE', unit: null, nominal: null, lsl: null, usl: null, instrument_type: null, severity: 'MINOR', spc: false, n: 5, method: 'Visual' }
        ]
      }
    ];

    const planMap = {};
    for (const p of plansDef) {
      const { rows: [pl] } = await client.query(
        `INSERT INTO inspection_plans(org_id, plan_no, product_id, stage, version, title, sampling_method, sample_size, accept_number, notes, active, approved_by, approved_at)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, true, $10, now()) RETURNING id`,
        [orgId, p.plan_no, p.product_id, p.stage, p.title, p.sampling_method, p.sample_size, p.accept_number, p.notes ?? null, U('qa')]
      );
      p.id = pl.id;
      planMap[p.plan_no] = p;
      let seq = 0;
      for (const ch of p.chars) {
        const { rows: [cRow] } = await client.query(
          `INSERT INTO plan_characteristics(plan_id, seq, name, type, unit, nominal, lsl, usl, instrument_type, method, severity, samples, spc)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
          [pl.id, ++seq * 10, ch.name, ch.type, ch.unit, ch.nominal, ch.lsl, ch.usl, ch.instrument_type, ch.method ?? null, ch.severity, ch.n, ch.spc]
        );
        ch.id = cRow.id;
      }
    }
    console.log("Created & approved 4 plans.");

    // 4. Create Work Orders
    const wo1 = (await client.query(`INSERT INTO work_orders(org_id, wo_no, product_id, line_id, planned_qty, status) VALUES (1, 'WO-26-1101', $1, $2, 12000, 'IN_PROGRESS') RETURNING id`, [P('DS-200'), L('CNC-1')])).rows[0].id;
    const wo2 = (await client.query(`INSERT INTO work_orders(org_id, wo_no, product_id, line_id, planned_qty, status) VALUES (1, 'WO-26-1102', $1, $2, 12000, 'IN_PROGRESS') RETURNING id`, [P('DS-200'), L('CNC-2')])).rows[0].id;
    const wo3 = (await client.query(`INSERT INTO work_orders(org_id, wo_no, product_id, line_id, planned_qty, status) VALUES (1, 'WO-26-1103', $1, $2, 40000, 'IN_PROGRESS') RETURNING id`, [P('MB-45'), L('PRS-1')])).rows[0].id;

    // Generators & Math
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = (m, s) => { const u = Math.max(rnd(), 1e-9), v = rnd(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

    const INSTR_MAP = {
      'Micrometer': ['MIC-01', 'MIC-02'], 'Vernier caliper': ['VC-03'], 'Roughness tester': ['SRT-01'], 'Hardness tester': ['HRC-01'], 'Dial indicator': ['DTI-02'],
      'Plug gauge / bore gauge': ['PG-01'], 'Height gauge': ['VC-03'], 'Coating gauge': ['CT-01']
    };
    const DEF_MAP = {
      'Outer diameter Ø25': v => (v > 25.02 ? 'D01' : 'D02'), 'Overall length': () => 'D03', 'Surface roughness Ra': () => 'D04', 'Chamfer & burr (visual)': () => 'D05',
      'Surface hardness': () => 'D07', 'Runout': () => 'D08', 'Visual – cracks, dents, rust': () => 'D10', 'Hole Ø10 H8': () => 'D11', 'Flatness': () => 'D14',
      'Zinc plating thickness': () => 'D09', 'Visual – burr, dent, plating defects': () => 'D06', 'Bar diameter Ø28': v => (v > 28.2 ? 'D01' : 'D02'), 'Mill test certificate verified': () => 'D13', 'Surface – rust / seams': () => 'D10'
    };

    let lotSeq = 0, ncrSeq = 0, inspSeq = 0;
    const ncrsBy = { cnc2: [], s03: [], fqc: [], other: [] };

    async function executeLot({ productCode, stage, qty, daysAgo, lineCode, supCode, woId, inspectorEmail, gen }) {
      lotSeq++;
      const pId = P(productCode);
      const plan = planMap[`CP-${productCode}-${stage}`];
      const lotDate = day(daysAgo);
      const lotNo = `${productCode}-${lotDate.replace(/-/g, '').slice(2)}-${String(lotSeq).padStart(3, '0')}`;
      const shift = ['A', 'B', 'C'][lotSeq % 3];
      const supId = supCode ? S(supCode) : null;
      const lId = lineCode ? L(lineCode) : null;
      const grn = supCode ? `GRN-${lotSeq}` : null;
      const inv = supCode ? `INV-${supCode}-${lotSeq}` : null;

      const { rows: [lot] } = await client.query(
        `INSERT INTO lots(org_id, lot_no, product_id, source, supplier_id, line_id, work_order_id, shift, stage, quantity, lot_date, grn_no, supplier_invoice, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'IN_INSPECTION', $14) RETURNING id, lot_no`,
        [orgId, lotNo, pId, supCode ? 'SUPPLIER' : 'PRODUCTION', supId, lId, woId ?? null, shift, stage, qty, lotDate, grn, inv, U('production')]
      );

      inspSeq++;
      const inspNo = `${stage}-2026-${String(inspSeq).padStart(4, '0')}`;
      const sampleSize = plan.sample_size;
      const inspTime = `now() - interval '${daysAgo} days' + interval '${8 + (lotSeq % 9)} hours'`;

      const { rows: [insp] } = await client.query(
        `INSERT INTO inspections(org_id, insp_no, lot_id, plan_id, stage, sample_size, accept_number, inspector_id, started_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${inspTime} - interval '25 minutes', 'DRAFT') RETURNING id`,
        [orgId, inspNo, lot.id, plan.id, stage, sampleSize, plan.accept_number, U(inspectorEmail)]
      );

      const results = [];
      const defects = {};
      let anyCriticalNG = false;
      const defectiveUnits = new Set();

      for (const ch of plan.chars) {
        for (let s = 1; s <= ch.n; s++) {
          const g = gen(ch.name, s);
          const instrCode = ch.instrument_type ? INSTR_MAP[ch.instrument_type][s % INSTR_MAP[ch.instrument_type].length] : null;
          const instrId = instrCode ? I(instrCode) : null;
          let okVal = true;
          let valNum = null;

          if (ch.type === 'VARIABLE') {
            valNum = Math.round(g * 10000) / 10000;
            if ((ch.usl != null && valNum > ch.usl) || (ch.lsl != null && valNum < ch.lsl)) {
              okVal = false;
              const defCode = DEF_MAP[ch.name](valNum);
              defects[defCode] = (defects[defCode] ?? 0) + 1;
              defectiveUnits.add(s);
              if (ch.severity === 'CRITICAL') anyCriticalNG = true;
            }
          } else {
            okVal = !!g;
            if (!okVal) {
              const defCode = DEF_MAP[ch.name]();
              defects[defCode] = (defects[defCode] ?? 0) + 1;
              defectiveUnits.add(s);
              if (ch.severity === 'CRITICAL') anyCriticalNG = true;
            }
          }
          results.push([insp.id, ch.id, s, valNum, okVal, instrId]);
        }
      }

      // Batch insert results
      for (const r of results) {
        await client.query(
          `INSERT INTO inspection_results(inspection_id, characteristic_id, sample_no, value, ok, instrument_id, measured_at)
           VALUES ($1, $2, $3, $4, $5, $6, ${inspTime} - interval '10 minutes')`,
          r
        );
      }

      // Insert defects
      for (const [code, count] of Object.entries(defects)) {
        await client.query(
          `INSERT INTO inspection_defects(inspection_id, defect_code_id, quantity, remarks)
           VALUES ($1, $2, $3, 'Found during inspection')`,
          [insp.id, D(code), count]
        );
      }

      // Submit logic
      const failed = anyCriticalNG || defectiveUnits.size > plan.accept_number;
      const resultStatus = failed ? 'FAIL' : 'PASS';
      let ncrId = null;

      if (failed) {
        ncrSeq++;
        const ncrNo = `NCR-2026-${String(ncrSeq).padStart(4, '0')}`;
        const severity = anyCriticalNG ? 'CRITICAL' : 'MAJOR';
        const title = `${stage} reject: non-conforming parameters`;
        const desc = `Lot ${lot.lot_no} failed ${stage} inspection: ${defectiveUnits.size} defective of ${sampleSize} sampled (Ac ${plan.accept_number}).`;

        const { rows: [ncr] } = await client.query(
          `INSERT INTO ncrs(org_id, ncr_no, source, inspection_id, lot_id, product_id, supplier_id, title, description, qty_affected, severity, raised_by, raised_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${inspTime}, 'OPEN') RETURNING id`,
          [orgId, ncrNo, supCode ? 'SUPPLIER' : 'INSPECTION', insp.id, lot.id, pId, supId, title, desc, qty, severity, U(inspectorEmail)]
        );
        ncrId = ncr.id;

        await client.query(`UPDATE lots SET status='ON_HOLD' WHERE id=$1`, [lot.id]);
      } else {
        await client.query(`UPDATE lots SET status='ACCEPTED', accepted_qty=$2, rejected_qty=0 WHERE id=$1`, [lot.id, qty]);
      }

      await client.query(
        `UPDATE inspections SET status='SUBMITTED', submitted_at=${inspTime}, result=$2, defective_units=$3, critical_fail=$4 WHERE id=$1`,
        [insp.id, resultStatus, defectiveUnits.size, anyCriticalNG]
      );

      return { lotId: lot.id, lotNo: lot.lot_no, inspectionId: insp.id, ncrId, failed, anyCriticalNG };
    }

    console.log("Simulating 6 weeks (42 days) of lots...");
    for (let d = 42; d >= 1; d--) {
      const wk = Math.floor((42 - d) / 7);
      const drift = d <= 20 && d >= 12 ? 0.0024 * (21 - d) : 0;
      const ds = (line, mOD) => (name, s) => name.startsWith('Outer') ? gauss(mOD, 0.0042) : name === 'Overall length' ? gauss(150.0, 0.025) : name.startsWith('Surface rough') ? gauss(0.52, 0.07) : rnd() > 0.002;

      // CNC-1
      const r1 = await executeLot({ productCode: 'DS-200', stage: 'IPQC', qty: 250, daysAgo: d, lineCode: 'CNC-1', woId: wo1, inspectorEmail: 'inspector', gen: ds('CNC-1', 25.001) });
      if (r1.ncrId) ncrsBy.other.push(r1);

      // CNC-2
      const r2 = await executeLot({ productCode: 'DS-200', stage: 'IPQC', qty: 250, daysAgo: d, lineCode: 'CNC-2', woId: wo2, inspectorEmail: 'inspector2', gen: ds('CNC-2', 25.002 + drift) });
      if (r2.ncrId) ncrsBy.cnc2.push(r2);

      // FQC DS-200 (every 2 days)
      if (d % 2 === 0) {
        const rf = await executeLot({ productCode: 'DS-200', stage: 'FQC', qty: 500, daysAgo: d, lineCode: 'HT-1', inspectorEmail: 'inspector', gen: (n) => n === 'Surface hardness' ? gauss(d === 30 ? 57.6 : 60.1, 0.6) : n === 'Runout' ? Math.abs(gauss(0.013, 0.005)) : rnd() > 0.003 });
        if (rf.ncrId) ncrsBy.fqc.push(rf);
      }

      // FQC MB-45
      const rm = await executeLot({ productCode: 'MB-45', stage: 'FQC', qty: 1000, daysAgo: d, lineCode: 'PRS-1', woId: wo3, inspectorEmail: d % 2 ? 'inspector' : 'inspector2', gen: (n) => n.startsWith('Hole') ? gauss(10.022, 0.006) : n === 'Flatness' ? Math.abs(gauss(0.018, 0.008)) : n.startsWith('Zinc') ? gauss(wk >= 4 ? 8.9 : 10.4, 0.6) : rnd() > 0.012 });
      if (rm.ncrId) ncrsBy.other.push(rm);

      // Supplier IQC
      if (d % 7 === 3) {
        for (const sup of ['S01', 'S02', 'S03']) {
          const bad = sup === 'S03' && (wk === 1 || wk === 3);
          const rs = await executeLot({ productCode: 'RM-EN19', stage: 'IQC', qty: 500, daysAgo: d, supCode: sup, inspectorEmail: 'inspector', gen: (n) => n.startsWith('Bar') ? gauss(bad ? 28.17 : 28.02, 0.05) : n.startsWith('Mill') ? !(sup === 'S03' && wk === 3) : rnd() > 0.02 });
          if (rs.ncrId) ncrsBy.s03.push(rs);
        }
      }
    }
    console.log(`Lots created: ${lotSeq}, Inspections: ${inspSeq}, NCRs: ${ncrSeq}`);

    // Dispositions & CAPAs
    for (const n of ncrsBy.cnc2) {
      await client.query(`UPDATE ncrs SET status='DISPOSITIONED', disposition='REWORK', disposition_qty=250, disposition_note='Oversize OD – regrind on cylindrical grinder and 100% re-check', cost_of_poor_quality=3800, disposed_by=$2, disposed_at=now() - interval '10 days' WHERE id=$1`, [n.ncrId, U('qa')]);
      await client.query(`UPDATE lots SET status='ACCEPTED', accepted_qty=250, rejected_qty=0 WHERE id=$1`, [n.lotId]);
    }
    for (const n of ncrsBy.s03) {
      await client.query(`UPDATE ncrs SET status='DISPOSITIONED', disposition='RETURN_TO_SUPPLIER', disposition_qty=500, disposition_note='Bar dia / MTC non-conforming – debit note raised on supplier', cost_of_poor_quality=1500, disposed_by=$2, disposed_at=now() - interval '8 days' WHERE id=$1`, [n.ncrId, U('qa')]);
      await client.query(`UPDATE lots SET status='REJECTED', accepted_qty=0, rejected_qty=500 WHERE id=$1`, [n.lotId]);
    }
    for (const n of [...ncrsBy.fqc, ...ncrsBy.other]) {
      const isHard = ncrsBy.fqc.includes(n);
      const disp = isHard ? 'SORT_100' : (n.anyCriticalNG ? 'SORT_100' : 'USE_AS_IS');
      const dQty = isHard ? 37 : (n.anyCriticalNG ? 12 : 0);
      const cost = isHard ? 9250 : 600;
      await client.query(`UPDATE ncrs SET status='DISPOSITIONED', disposition=$2, disposition_qty=$3, disposition_note='MRB disposition completed', cost_of_poor_quality=$4, disposed_by=$5, disposed_at=now() - interval '5 days' WHERE id=$1`, [n.ncrId, disp, dQty, cost, U('qa')]);
      await client.query(`UPDATE lots SET status='CONDITIONAL', accepted_qty=quantity-$2, rejected_qty=$2 WHERE id=$1`, [n.lotId, dQty]);
    }

    // Customer complaint & CAPA (8D)
    const { rows: [cc] } = await client.query(
      `INSERT INTO ncrs(org_id, ncr_no, source, customer, product_id, severity, qty_affected, title, description, raised_by, raised_at, status)
       VALUES (1, 'NCR-2026-0014', 'CUSTOMER_COMPLAINT', 'Tata Motors', $1, 'MAJOR', 120, 'White rust on brackets at customer line', 'Tata Motors Pune reported white rust on 120 brackets from 3 lots; plating thickness found 7.6–8.2 µm.', $2, now() - interval '6 days', 'OPEN') RETURNING id`,
      [P('MB-45'), U('qa')]
    );

    // CAPA 1
    const { rows: [c1] } = await client.query(
      `INSERT INTO capas(org_id, capa_no, title, owner_id, team, problem, target_date, created_by, status, containment, root_cause_method, whys, root_cause)
       VALUES (1, 'CAPA-2026-0001', 'CNC-2 Ø25 oversize due to insert wear', $1, 'Ravi (Prod), Meera (QA), Tool room, Maintenance',
               'What: OD Ø25 above 25.020 mm on DS-200. Where: CNC-2. When: 9 consecutive days.', CURRENT_DATE - 10, $2, 'ACTIONS',
               'All CNC-2 lots since last good check quarantined and 100% gauged; insert changed; first-off approval re-done.',
               '5WHY', '["OD oversize", "Insert worn beyond limit", "Insert not changed at planned count", "No tool-life counter on CNC-2 (manual log missed)", "Tool-life control not in PFMEA/control plan"]'::jsonb,
               'No automatic tool-life monitoring on CNC-2; manual insert change log was missed on night shift.') RETURNING id`,
      [U('production'), U('qa')]
    );
    for (const n of ncrsBy.cnc2) await client.query(`UPDATE ncrs SET capa_id=$1 WHERE id=$2`, [c1.id, n.ncrId]);

    // CAPA 1 actions
    await client.query(`INSERT INTO capa_actions(capa_id, kind, description, owner_id, due_date, status, completed_on, evidence)
                        VALUES ($1, 'CORRECTIVE', 'Enable tool-life counter in CNC-2 controller (alarm at 400 pcs)', $2, CURRENT_DATE + 5, 'DONE', CURRENT_DATE - 2, 'Controller param #6810 set; alarm verified on 3 cycles')`, [c1.id, U('production')]);
    await client.query(`INSERT INTO capa_actions(capa_id, kind, description, owner_id, due_date, status)
                        VALUES ($1, 'PREVENTIVE', 'Add tool-life control to PFMEA & control plan for all CNC cells; SPC on Ø25 every 2 h', $2, CURRENT_DATE - 2, 'OPEN')`, [c1.id, U('qa')]);

    // CAPA 2 (closed)
    const { rows: [c2] } = await client.query(
      `INSERT INTO capas(org_id, capa_no, title, owner_id, problem, target_date, created_by, status, containment, root_cause_method, root_cause, verification, effective, closed_by, closed_at)
       VALUES (1, 'CAPA-2026-0002', 'Metro Bar EN19 diameter & MTC non-conformance', $1, 'Two IQC rejections from S03: Ø28 oversize and missing mill certificates.', CURRENT_DATE + 3, $1, 'CLOSED',
               'S03 put on CONDITIONAL status; 100% IQC for next 5 lots.', 'FISHBONE', 'Supplier had no outgoing inspection and an uncalibrated micrometer.',
               'Next 4 lots from S03 accepted at IQC with PDI reports', true, $1, now() - interval '1 day') RETURNING id`,
      [U('qa')]
    );
    for (const n of ncrsBy.s03) await client.query(`UPDATE ncrs SET capa_id=$1, status='CLOSED', closed_by=$3, closed_at=now() WHERE id=$2`, [c2.id, n.ncrId, U('qa')]);

    // CAPA 3
    const { rows: [c3] } = await client.query(
      `INSERT INTO capas(org_id, capa_no, title, owner_id, problem, target_date, created_by, status)
       VALUES (1, 'CAPA-2026-0003', 'Zinc plating thickness low – white rust complaint', $1, 'Customer complaint + FQC trend: plating thickness drifting to ~9 µm (LSL 8).', CURRENT_DATE - 20, $2, 'OPEN') RETURNING id`,
      [U('production'), U('qa')]
    );
    await client.query(`UPDATE ncrs SET capa_id=$1 WHERE id=$2`, [c3.id, cc.id]);

    console.log("FAST POPULATION COMPLETE!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
