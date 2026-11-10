# QualityPilot — Production Quality Management System

QualityPilot is an enterprise Production Quality Management System designed according to **ISO 9001:2015** and **IATF 16949:2016** standards.

## Features
- **Control Plans**: Versioned inspection plans with QA approval, ISO 2859-1 Level II sampling, variable and attribute characteristics, severity levels, and automated pass/fail criteria.
- **Inspection Engine**: Complete shop-floor inspection with live nominal/LSL/USL tolerance calculations, calibrated gauge selection, inline defect capture, and instant locking.
- **NCR & Material Review Board (MRB)**: Automatic non-conformance reporting on failure, lot quarantine, and MRB dispositions (Rework, Scrap, Return to Supplier, 100% Sort, Use-As-Is).
- **8D CAPA Problem Solving**: Gated D1–D8 workflow, 5-Why root cause analysis, 6M Fishbone diagrams, corrective & preventive action tracking with evidence attachments, and effectiveness verification.
- **Statistical Process Control (SPC)**: X̄-R and I-MR control charts, AIAG constants, Western Electric out-of-control run rules, capability indexes ($C_p, C_{pk}, P_p, P_{pk}$), and histogram distributions.
- **Gauges & Calibration**: Reverse traceability, calibration records, automated status views (OK, DUE_SOON, OVERDUE, OUT_OF_SERVICE), and database-level trigger blocking for expired instruments.
- **Supplier Quality & Analytics**: Defect Pareto (with 80% line), weekly first-pass yield (FPY) trends, cost of poor quality (COPQ), and supplier quality scorecards.

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL 16 + native SQL triggers & views
- **Auth & Security**: JWT session cookies (`jose`), `bcryptjs`, and database-level segregation of duties
- **Charts**: Custom SVG charting engine for zero-dependency high-performance visualization

## Run
```bash
cd server
npm install
npm run build
npm start   # http://localhost:3000
```

### Demo Logins (Password: `Admin@123`)
- `qa@qms.local` — Sunita Rao (QA Manager)
- `admin@qms.local` — Plant Head (Admin)
- `inspector@qms.local` — Arjun Patel (Inspector)
- `inspector2@qms.local` — Meera Joshi (Inspector)
- `production@qms.local` — Ravi Kumar (Production)
- `viewer@qms.local` — Customer Auditor (Viewer)
