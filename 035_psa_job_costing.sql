-- ============================================================================
-- Phase 6C — PSA Job Costing
-- ============================================================================
-- Versioned user rates (internal cost + billable), org cost config
-- (overhead burden + default markup), estimated/actual budget fields
-- on tickets, and a view that computes live costing per ticket.
-- ============================================================================

-- ============================================================================
-- psa_user_rates — versioned rate history
-- ============================================================================
CREATE TABLE IF NOT EXISTS psa_user_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  internal_cost_rate NUMERIC(10, 2) NOT NULL,
  billable_rate NUMERIC(10, 2) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_rates_user ON psa_user_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rates_current ON psa_user_rates(user_id, effective_to) WHERE effective_to IS NULL;

ALTER TABLE psa_user_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_rates_org_isolation ON psa_user_rates;
CREATE POLICY user_rates_org_isolation ON psa_user_rates
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- psa_org_cost_config — one row per org
-- ============================================================================
CREATE TABLE IF NOT EXISTS psa_org_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  overhead_burden_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  default_parts_markup_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE psa_org_cost_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_cost_config_isolation ON psa_org_cost_config;
CREATE POLICY org_cost_config_isolation ON psa_org_cost_config
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Seed default row for each existing org
INSERT INTO psa_org_cost_config (org_id, overhead_burden_pct, default_parts_markup_pct)
SELECT id, 0, 0 FROM organizations
ON CONFLICT (org_id) DO NOTHING;

-- ============================================================================
-- psa_tickets — add budget baseline columns
-- ============================================================================
ALTER TABLE psa_tickets ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(8, 2);
ALTER TABLE psa_tickets ADD COLUMN IF NOT EXISTS estimated_labor_cost NUMERIC(12, 2);
ALTER TABLE psa_tickets ADD COLUMN IF NOT EXISTS estimated_parts_cost NUMERIC(12, 2);
ALTER TABLE psa_tickets ADD COLUMN IF NOT EXISTS quoted_revenue NUMERIC(12, 2);

-- ============================================================================
-- psa_ticket_costing_v — live per-ticket costing rollup
-- ============================================================================
-- Labor cost = sum(hours * current_internal_rate) burdened by overhead_burden_pct
-- Labor revenue = sum(hours * entry.rate WHERE billable) — falls back to current billable rate
-- Parts cost = sum(quantity * cost)
-- Parts revenue = sum(quantity * cost * (1 + markup_pct / 100))
-- Gross margin = revenue - cost ; gm_pct = margin / revenue
-- Budget burn pct = actual_labor_hours / estimated_hours (NULL if no estimate)
-- ============================================================================
CREATE OR REPLACE VIEW psa_ticket_costing_v AS
SELECT
  t.id AS ticket_id,
  t.org_id,
  t.ticket_number,
  t.title,
  t.status,
  t.priority,
  t.costing_enabled,
  t.estimated_hours,
  t.estimated_labor_cost,
  t.estimated_parts_cost,
  t.quoted_revenue,
  COALESCE(l.actual_hours, 0) AS actual_hours,
  COALESCE(l.actual_labor_cost, 0) AS actual_labor_cost_raw,
  COALESCE(l.actual_labor_cost, 0) * (1 + COALESCE(cfg.overhead_burden_pct, 0) / 100) AS actual_labor_cost,
  COALESCE(l.actual_labor_revenue, 0) AS actual_labor_revenue,
  COALESCE(p.actual_parts_cost, 0) AS actual_parts_cost,
  COALESCE(p.actual_parts_revenue, 0) AS actual_parts_revenue,
  (COALESCE(l.actual_labor_cost, 0) * (1 + COALESCE(cfg.overhead_burden_pct, 0) / 100))
    + COALESCE(p.actual_parts_cost, 0) AS total_cost,
  COALESCE(l.actual_labor_revenue, 0) + COALESCE(p.actual_parts_revenue, 0) AS total_revenue,
  (COALESCE(l.actual_labor_revenue, 0) + COALESCE(p.actual_parts_revenue, 0))
    - ((COALESCE(l.actual_labor_cost, 0) * (1 + COALESCE(cfg.overhead_burden_pct, 0) / 100))
       + COALESCE(p.actual_parts_cost, 0)) AS gross_margin,
  CASE
    WHEN COALESCE(l.actual_labor_revenue, 0) + COALESCE(p.actual_parts_revenue, 0) = 0 THEN NULL
    ELSE ((COALESCE(l.actual_labor_revenue, 0) + COALESCE(p.actual_parts_revenue, 0))
          - ((COALESCE(l.actual_labor_cost, 0) * (1 + COALESCE(cfg.overhead_burden_pct, 0) / 100))
             + COALESCE(p.actual_parts_cost, 0)))
         / (COALESCE(l.actual_labor_revenue, 0) + COALESCE(p.actual_parts_revenue, 0)) * 100
  END AS gm_pct,
  CASE
    WHEN t.estimated_hours IS NULL OR t.estimated_hours = 0 THEN NULL
    ELSE COALESCE(l.actual_hours, 0) / t.estimated_hours * 100
  END AS budget_burn_pct
FROM psa_tickets t
LEFT JOIN psa_org_cost_config cfg ON cfg.org_id = t.org_id
LEFT JOIN (
  SELECT
    te.ticket_id,
    SUM(te.hours) AS actual_hours,
    SUM(te.hours * COALESCE(ur.internal_cost_rate, 0)) AS actual_labor_cost,
    SUM(CASE WHEN te.billable THEN te.hours * COALESCE(te.rate, ur.billable_rate, 0) ELSE 0 END) AS actual_labor_revenue
  FROM psa_time_entries te
  LEFT JOIN psa_user_rates ur
    ON ur.user_id = te.user_id
    AND ur.effective_from <= te.entry_date
    AND (ur.effective_to IS NULL OR ur.effective_to >= te.entry_date)
  GROUP BY te.ticket_id
) l ON l.ticket_id = t.id
LEFT JOIN (
  SELECT
    tp.ticket_id,
    SUM(tp.quantity * COALESCE(tp.cost, 0)) AS actual_parts_cost,
    SUM(tp.quantity * COALESCE(tp.cost, 0) * (1 + COALESCE(tp.markup_pct, 0) / 100)) AS actual_parts_revenue
  FROM psa_ticket_parts tp
  GROUP BY tp.ticket_id
) p ON p.ticket_id = t.id;

-- updated_at trigger on config
DROP TRIGGER IF EXISTS trg_org_cost_config_touch ON psa_org_cost_config;
CREATE TRIGGER trg_org_cost_config_touch BEFORE UPDATE ON psa_org_cost_config
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
