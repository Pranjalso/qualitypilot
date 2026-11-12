-- =====================================================================
--  QualityPilot — Production Quality Management System
--  Inspection (IQC · IPQC · FQC · PDI) · NCR · CAPA (8D) · SPC · Calibration · Supplier quality
--  PostgreSQL 14+
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE qms_role     AS ENUM ('ADMIN','QA_MANAGER','INSPECTOR','PRODUCTION','VIEWER');
CREATE TYPE insp_stage   AS ENUM ('IQC','IPQC','FQC','PDI');      -- incoming · in-process · final · pre-dispatch
CREATE TYPE char_type    AS ENUM ('VARIABLE','ATTRIBUTE');
CREATE TYPE severity     AS ENUM ('CRITICAL','MAJOR','MINOR');
CREATE TYPE lot_status   AS ENUM ('PENDING','IN_INSPECTION','ACCEPTED','REJECTED','ON_HOLD','CONDITIONAL');
CREATE TYPE insp_status  AS ENUM ('DRAFT','SUBMITTED','APPROVED');
CREATE TYPE insp_result  AS ENUM ('PASS','FAIL');
CREATE TYPE ncr_status   AS ENUM ('OPEN','UNDER_REVIEW','DISPOSITIONED','CLOSED','CANCELLED');
CREATE TYPE disposition  AS ENUM ('REWORK','SCRAP','USE_AS_IS','RETURN_TO_SUPPLIER','REGRADE','SORT_100');
CREATE TYPE capa_status  AS ENUM ('OPEN','CONTAINMENT','ROOT_CAUSE','ACTIONS','VERIFICATION','CLOSED');

-- ---------- Organisation & users --------------------------------------
CREATE TABLE organizations (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  industry   TEXT NOT NULL DEFAULT 'MANUFACTURING',
  address    TEXT,
  certifications TEXT,                         -- e.g. ISO 9001:2015, IATF 16949
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE plants (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, address TEXT, UNIQUE (org_id, code)
);
CREATE TABLE production_lines (
  id SERIAL PRIMARY KEY, plant_id INT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, UNIQUE (plant_id, code)
);
CREATE TABLE users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  employee_code TEXT, last_org_id INT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role qms_role NOT NULL, PRIMARY KEY (org_id, user_id)
);

-- ---------- Masters ------------------------------------------------------
CREATE TABLE products (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, drawing_no TEXT, revision TEXT NOT NULL DEFAULT 'A',
  uom TEXT NOT NULL DEFAULT 'NOS', category TEXT, customer TEXT, active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (org_id, code)
);
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, contact TEXT, email TEXT,
  approval TEXT NOT NULL DEFAULT 'APPROVED' CHECK (approval IN ('APPROVED','CONDITIONAL','BLOCKED')),
  UNIQUE (org_id, code)
);
CREATE TABLE defect_codes (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'DIMENSIONAL',  -- DIMENSIONAL · VISUAL · FUNCTIONAL · MATERIAL · PACKING
  severity severity NOT NULL DEFAULT 'MAJOR', active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE (org_id, code)
);

-- ---------- Measuring instruments & calibration ---------------------------
CREATE TABLE instruments (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, make TEXT, serial_no TEXT,
  range_text TEXT, least_count TEXT, location TEXT,
  calibration_interval_days INT NOT NULL DEFAULT 365 CHECK (calibration_interval_days > 0),
  last_calibrated DATE, next_due DATE,
  out_of_service BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (org_id, code)
);
CREATE TABLE calibration_records (
  id SERIAL PRIMARY KEY, instrument_id INT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  calibrated_on DATE NOT NULL, agency TEXT NOT NULL, certificate_no TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS','FAIL','ADJUSTED')), error_found TEXT, next_due DATE NOT NULL,
  certificate_url TEXT, recorded_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (next_due > calibrated_on)
);
-- keep instrument dates in step with its latest calibration
CREATE OR REPLACE FUNCTION apply_calibration() RETURNS TRIGGER AS $$
BEGIN
  UPDATE instruments SET last_calibrated = NEW.calibrated_on, next_due = NEW.next_due,
         out_of_service = (NEW.result = 'FAIL')
   WHERE id = NEW.instrument_id AND (last_calibrated IS NULL OR last_calibrated <= NEW.calibrated_on);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_apply_calibration AFTER INSERT ON calibration_records FOR EACH ROW EXECUTE FUNCTION apply_calibration();

-- ---------- Inspection plans (control plan) -------------------------------
CREATE TABLE inspection_plans (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_no TEXT NOT NULL, product_id INT NOT NULL REFERENCES products(id), stage insp_stage NOT NULL,
  version INT NOT NULL DEFAULT 1, title TEXT NOT NULL,
  sampling_method TEXT NOT NULL DEFAULT 'FIXED' CHECK (sampling_method IN ('FIXED','PERCENT','HUNDRED','ISO2859')),
  sample_size INT CHECK (sample_size > 0),        -- FIXED
  sample_percent NUMERIC(5,2),                     -- PERCENT
  accept_number INT NOT NULL DEFAULT 0 CHECK (accept_number >= 0),   -- max defective units allowed in the sample (Ac); reject at Ac+1
  active BOOLEAN NOT NULL DEFAULT TRUE, approved_by INT REFERENCES users(id), approved_at TIMESTAMPTZ,
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, plan_no, version)
);
-- one active plan per product & stage
CREATE UNIQUE INDEX uq_active_plan ON inspection_plans(product_id, stage) WHERE active;

CREATE TABLE plan_characteristics (
  id SERIAL PRIMARY KEY, plan_id INT NOT NULL REFERENCES inspection_plans(id) ON DELETE CASCADE,
  seq INT NOT NULL, name TEXT NOT NULL, type char_type NOT NULL, unit TEXT,
  nominal NUMERIC(14,5), lsl NUMERIC(14,5), usl NUMERIC(14,5),          -- either limit may be NULL (one-sided)
  instrument_type TEXT, method TEXT, severity severity NOT NULL DEFAULT 'MAJOR',
  samples INT,                                     -- per-characteristic sample count override
  spc BOOLEAN NOT NULL DEFAULT FALSE,              -- plot on control chart
  UNIQUE (plan_id, seq),
  CHECK (type = 'ATTRIBUTE' OR lsl IS NOT NULL OR usl IS NOT NULL),
  CHECK (lsl IS NULL OR usl IS NULL OR lsl < usl)
);

-- ---------- Production orders & lots -------------------------------------
CREATE TABLE work_orders (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wo_no TEXT NOT NULL, product_id INT NOT NULL REFERENCES products(id), line_id INT REFERENCES production_lines(id),
  planned_qty NUMERIC(14,3) NOT NULL CHECK (planned_qty > 0), start_date DATE, end_date DATE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CLOSED')),
  UNIQUE (org_id, wo_no)
);
CREATE TABLE lots (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lot_no TEXT NOT NULL, product_id INT NOT NULL REFERENCES products(id),
  source TEXT NOT NULL CHECK (source IN ('SUPPLIER','PRODUCTION')),
  supplier_id INT REFERENCES suppliers(id), supplier_invoice TEXT, grn_no TEXT,
  work_order_id INT REFERENCES work_orders(id), line_id INT REFERENCES production_lines(id), shift TEXT,
  stage insp_stage NOT NULL, quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  lot_date DATE NOT NULL DEFAULT CURRENT_DATE, status lot_status NOT NULL DEFAULT 'PENDING',
  accepted_qty NUMERIC(14,3) NOT NULL DEFAULT 0, rejected_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, lot_no, stage),
  CHECK ((source = 'SUPPLIER') = (supplier_id IS NOT NULL)),
  CHECK (accepted_qty + rejected_qty <= quantity)
);
CREATE INDEX idx_lots_status ON lots(org_id, status, stage);

-- ---------- Inspections -----------------------------------------------------
CREATE TABLE inspections (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  insp_no TEXT NOT NULL, lot_id INT NOT NULL REFERENCES lots(id), plan_id INT NOT NULL REFERENCES inspection_plans(id),
  stage insp_stage NOT NULL, sample_size INT NOT NULL CHECK (sample_size > 0), accept_number INT NOT NULL,
  inspector_id INT REFERENCES users(id), started_at TIMESTAMPTZ NOT NULL DEFAULT now(), submitted_at TIMESTAMPTZ,
  status insp_status NOT NULL DEFAULT 'DRAFT', result insp_result,
  defective_units INT NOT NULL DEFAULT 0, critical_fail BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by INT REFERENCES users(id), approved_at TIMESTAMPTZ, remarks TEXT,
  is_reinspection BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (org_id, insp_no)
);
CREATE INDEX idx_insp_lot ON inspections(lot_id);

CREATE TABLE inspection_results (
  id BIGSERIAL PRIMARY KEY, inspection_id INT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  characteristic_id INT NOT NULL REFERENCES plan_characteristics(id), sample_no INT NOT NULL CHECK (sample_no > 0),
  value NUMERIC(14,5),                          -- VARIABLE
  ok BOOLEAN,                                   -- ATTRIBUTE (and computed for VARIABLE)
  instrument_id INT REFERENCES instruments(id),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, characteristic_id, sample_no)
);
CREATE INDEX idx_results_char ON inspection_results(characteristic_id, measured_at);

-- results: compute OK against spec; refuse measurements with an overdue / out-of-service instrument
CREATE OR REPLACE FUNCTION check_result() RETURNS TRIGGER AS $$
DECLARE c plan_characteristics%ROWTYPE; i instruments%ROWTYPE;
BEGIN
  SELECT * INTO c FROM plan_characteristics WHERE id = NEW.characteristic_id;
  IF c.type = 'VARIABLE' THEN
    IF NEW.value IS NULL THEN RAISE EXCEPTION 'A measured value is required for %', c.name USING ERRCODE = 'check_violation'; END IF;
    NEW.ok := (c.lsl IS NULL OR NEW.value >= c.lsl) AND (c.usl IS NULL OR NEW.value <= c.usl);
  ELSIF NEW.ok IS NULL THEN
    RAISE EXCEPTION 'OK / Not OK is required for %', c.name USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.instrument_id IS NOT NULL THEN
    SELECT * INTO i FROM instruments WHERE id = NEW.instrument_id;
    IF i.out_of_service THEN RAISE EXCEPTION 'Instrument % is out of service', i.code USING ERRCODE = 'check_violation'; END IF;
    IF i.next_due IS NOT NULL AND i.next_due < CURRENT_DATE THEN
      RAISE EXCEPTION 'Instrument % calibration expired on % — use a calibrated instrument', i.code, i.next_due USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM inspections WHERE id = NEW.inspection_id AND status <> 'DRAFT') THEN
    RAISE EXCEPTION 'Inspection is already submitted; results are locked' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_result BEFORE INSERT OR UPDATE ON inspection_results FOR EACH ROW EXECUTE FUNCTION check_result();

CREATE TABLE inspection_defects (
  id SERIAL PRIMARY KEY, inspection_id INT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  defect_code_id INT NOT NULL REFERENCES defect_codes(id), quantity INT NOT NULL CHECK (quantity > 0),
  characteristic_id INT REFERENCES plan_characteristics(id), remarks TEXT,
  photo_url TEXT, photo_mime TEXT
);

-- ---------- Non-conformance reports ------------------------------------------
CREATE TABLE ncrs (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ncr_no TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('INSPECTION','CUSTOMER_COMPLAINT','INTERNAL_AUDIT','PROCESS','SUPPLIER')),
  inspection_id INT REFERENCES inspections(id), lot_id INT REFERENCES lots(id),
  product_id INT REFERENCES products(id), supplier_id INT REFERENCES suppliers(id), customer TEXT,
  title TEXT NOT NULL, description TEXT NOT NULL, qty_affected NUMERIC(14,3) NOT NULL DEFAULT 0,
  severity severity NOT NULL DEFAULT 'MAJOR', status ncr_status NOT NULL DEFAULT 'OPEN',
  disposition disposition, disposition_qty NUMERIC(14,3), disposition_note TEXT,
  disposed_by INT REFERENCES users(id), disposed_at TIMESTAMPTZ,
  cost_of_poor_quality NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_of_poor_quality >= 0),
  capa_id INT, photo_url TEXT, raised_by INT REFERENCES users(id), raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by INT REFERENCES users(id), closed_at TIMESTAMPTZ,
  UNIQUE (org_id, ncr_no),
  CHECK (status NOT IN ('DISPOSITIONED','CLOSED') OR disposition IS NOT NULL)
);
CREATE INDEX idx_ncr_status ON ncrs(org_id, status);

-- ---------- CAPA (8D) ----------------------------------------------------------
CREATE TABLE capas (
  id SERIAL PRIMARY KEY, org_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_no TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'CORRECTIVE' CHECK (type IN ('CORRECTIVE','PREVENTIVE')),
  title TEXT NOT NULL, owner_id INT REFERENCES users(id), team TEXT,             -- D1
  problem TEXT NOT NULL,                                                          -- D2 (5W2H)
  containment TEXT,                                                               -- D3
  root_cause_method TEXT CHECK (root_cause_method IN ('5WHY','FISHBONE','FTA','OTHER')),
  whys JSONB NOT NULL DEFAULT '[]',                                               -- D4 5-why chain
  fishbone JSONB NOT NULL DEFAULT '{}',                                           -- D4 Man/Machine/Method/Material/Measurement/Environment
  root_cause TEXT,
  verification TEXT, effective BOOLEAN,                                           -- D7
  lessons TEXT,                                                                   -- D8
  status capa_status NOT NULL DEFAULT 'OPEN', target_date DATE NOT NULL,
  created_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by INT REFERENCES users(id), closed_at TIMESTAMPTZ,
  UNIQUE (org_id, capa_no),
  CHECK (status <> 'CLOSED' OR (root_cause IS NOT NULL AND verification IS NOT NULL AND effective IS TRUE))
);
ALTER TABLE ncrs ADD CONSTRAINT fk_ncr_capa FOREIGN KEY (capa_id) REFERENCES capas(id);

CREATE TABLE capa_actions (                                                       -- D5/D6
  id SERIAL PRIMARY KEY, capa_id INT NOT NULL REFERENCES capas(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'CORRECTIVE' CHECK (kind IN ('CONTAINMENT','CORRECTIVE','PREVENTIVE')),
  description TEXT NOT NULL, owner_id INT REFERENCES users(id), due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE','CANCELLED')),
  completed_on DATE, evidence TEXT
);

-- ---------- Numbering & audit -------------------------------------------------
CREATE TABLE doc_series (org_id INT, doc_type TEXT, yr INT, last_no INT NOT NULL DEFAULT 0, PRIMARY KEY (org_id, doc_type, yr));
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

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY, org_id INT, user_id INT, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT,
  detail JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Views ---------------------------------------------------------------
CREATE VIEW v_instrument_status AS
SELECT i.*, CASE WHEN i.out_of_service THEN 'OUT_OF_SERVICE'
                 WHEN i.next_due IS NULL THEN 'NOT_CALIBRATED'
                 WHEN i.next_due < CURRENT_DATE THEN 'OVERDUE'
                 WHEN i.next_due <= CURRENT_DATE + 30 THEN 'DUE_SOON' ELSE 'OK' END AS cal_status,
       i.next_due - CURRENT_DATE AS days_left
FROM instruments i;

-- supplier performance (incoming lots)
CREATE VIEW v_supplier_quality AS
SELECT s.id AS supplier_id, s.org_id, s.code, s.name, s.approval,
       COUNT(l.id) FILTER (WHERE l.status IN ('ACCEPTED','REJECTED','CONDITIONAL')) AS lots_inspected,
       COUNT(l.id) FILTER (WHERE l.status = 'REJECTED') AS lots_rejected,
       COALESCE(SUM(l.quantity) FILTER (WHERE l.status IN ('ACCEPTED','REJECTED','CONDITIONAL')),0) AS qty_received,
       COALESCE(SUM(l.rejected_qty),0) AS qty_rejected,
       CASE WHEN COALESCE(SUM(l.quantity) FILTER (WHERE l.status IN ('ACCEPTED','REJECTED','CONDITIONAL')),0) = 0 THEN 0
            ELSE ROUND(SUM(l.rejected_qty) * 1000000.0 / SUM(l.quantity) FILTER (WHERE l.status IN ('ACCEPTED','REJECTED','CONDITIONAL'))) END AS ppm,
       (SELECT COUNT(*) FROM ncrs n WHERE n.supplier_id = s.id AND n.status NOT IN ('CLOSED','CANCELLED')) AS open_ncrs
FROM suppliers s LEFT JOIN lots l ON l.supplier_id = s.id
GROUP BY s.id;
