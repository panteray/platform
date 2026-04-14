-- ============================================================================
-- Migration 037 — PSA Invoicing + RMR Billing Engine
-- Phase 7B + 7C
-- ============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'DRAFT', 'SENT', 'VIEWED', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'VOID', 'WRITTEN_OFF'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_source AS ENUM (
    'TICKET', 'PROJECT', 'CONTRACT_RMR', 'MANUAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'CHECK', 'ACH', 'WIRE', 'CASH', 'CREDIT_CARD_OFFLINE', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_line_source AS ENUM (
    'LABOR', 'PARTS', 'RMR', 'FEE', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'RENEWED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_billing_model AS ENUM (
    'PER_DEVICE', 'PER_DOOR', 'PER_CAMERA', 'PCT_SYSTEM_VALUE',
    'PER_ROOM', 'PER_USER', 'PER_ENDPOINT', 'FLAT_SITE',
    'BLOCK_TIME', 'TIERED', 'MILESTONE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_billing_cycle AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE block_time_rollover AS ENUM ('NONE', 'FULL', 'CAPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_event_type AS ENUM (
    'CREATED', 'ACTIVATED', 'BILLED', 'RENEWED', 'CANCELLED', 'PAUSED', 'ESCALATED', 'BLOCK_DEBIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Service Contracts (RMR) ----------
CREATE TABLE IF NOT EXISTS service_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status contract_status NOT NULL DEFAULT 'DRAFT',
  billing_model contract_billing_model NOT NULL,
  billing_cycle contract_billing_cycle NOT NULL DEFAULT 'MONTHLY',
  start_date DATE NOT NULL,
  end_date DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  renewal_notice_days INTEGER NOT NULL DEFAULT 30,
  annual_escalation_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  next_bill_date DATE,
  last_billed_at TIMESTAMPTZ,
  -- Block time fields (only used when billing_model = BLOCK_TIME)
  block_hours_total NUMERIC(8,2),
  block_hours_used NUMERIC(8,2) NOT NULL DEFAULT 0,
  block_rollover_type block_time_rollover NOT NULL DEFAULT 'NONE',
  block_rollover_cap NUMERIC(8,2),
  overage_rate NUMERIC(10,2),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_service_contracts_org ON service_contracts (org_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_customer ON service_contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_active ON service_contracts (org_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_service_contracts_next_bill ON service_contracts (next_bill_date) WHERE status = 'ACTIVE';

-- CT-000001 auto-number (per-org)
CREATE OR REPLACE FUNCTION service_contract_number_trigger() RETURNS TRIGGER AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 4) AS BIGINT)), 0) + 1
      INTO next_num
      FROM service_contracts
      WHERE org_id = NEW.org_id AND contract_number ~ '^CT-[0-9]+$';
    NEW.contract_number := 'CT-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS service_contracts_number ON service_contracts;
CREATE TRIGGER service_contracts_number
  BEFORE INSERT ON service_contracts
  FOR EACH ROW EXECUTE FUNCTION service_contract_number_trigger();

DROP TRIGGER IF EXISTS service_contracts_touch ON service_contracts;
CREATE TRIGGER service_contracts_touch
  BEFORE UPDATE ON service_contracts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Contract Line Items (per-device billing) ----------
CREATE TABLE IF NOT EXISTS contract_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_line_items_contract ON contract_line_items (contract_id);

-- ---------- Contract Events (timeline) ----------
CREATE TABLE IF NOT EXISTS contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type contract_event_type NOT NULL,
  details JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_events_contract ON contract_events (contract_id);

-- ---------- Invoices ----------
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source invoice_source NOT NULL DEFAULT 'MANUAL',
  source_ticket_id UUID REFERENCES psa_tickets(id) ON DELETE SET NULL,
  source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  source_contract_id UUID REFERENCES service_contracts(id) ON DELETE SET NULL,
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  late_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + tax_amount + late_fee_amount) STORED,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices (org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (org_id, due_date) WHERE status NOT IN ('PAID', 'VOID', 'WRITTEN_OFF');
CREATE INDEX IF NOT EXISTS idx_invoices_ticket ON invoices (source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices (source_project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices (source_contract_id);

-- INV-000001 auto-number (per-org)
CREATE OR REPLACE FUNCTION invoice_number_trigger() RETURNS TRIGGER AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS BIGINT)), 0) + 1
      INTO next_num
      FROM invoices
      WHERE org_id = NEW.org_id AND invoice_number ~ '^INV-[0-9]+$';
    NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_number ON invoices;
CREATE TRIGGER invoices_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoice_number_trigger();

DROP TRIGGER IF EXISTS invoices_touch ON invoices;
CREATE TRIGGER invoices_touch
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Invoice Line Items ----------
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  source_type invoice_line_source NOT NULL DEFAULT 'OTHER',
  source_ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);

-- ---------- Invoice Payments ----------
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method NOT NULL,
  reference_number TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments (invoice_id);

-- ---------- Invoice Reminders (touchpoints 1..7) ----------
CREATE TABLE IF NOT EXISTS invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  touchpoint INTEGER NOT NULL CHECK (touchpoint BETWEEN 1 AND 7),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice ON invoice_reminders (invoice_id);

-- ---------- RLS ----------
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY service_contracts_org ON service_contracts FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY contract_line_items_org ON contract_line_items FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY contract_events_org ON contract_events FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoices_org ON invoices FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoice_line_items_org ON invoice_line_items FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoice_payments_org ON invoice_payments FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoice_reminders_org ON invoice_reminders FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
