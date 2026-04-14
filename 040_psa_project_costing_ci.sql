-- ============================================================================
-- 040: Project-level WIP rollup + CI dependency graph (G6)
-- ============================================================================
-- Adds:
--   1. psa_project_costing_v: rollup of psa_ticket_costing_v grouped by project_id
--   2. asset_relationships: directed CI graph (parent -> child) for impact analysis
-- ============================================================================

-- ----------------------------------------------------------------------------
-- psa_project_costing_v
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW psa_project_costing_v AS
SELECT
  p.id                                                   AS project_id,
  p.org_id,
  p.pn                                                   AS project_number,
  p.name                                                 AS project_name,
  p.status                                               AS project_status,
  COUNT(tc.ticket_id)                                    AS ticket_count,
  COUNT(tc.ticket_id) FILTER (
    WHERE tc.status NOT IN ('RESOLVED', 'CANCELLED')
  )                                                      AS open_ticket_count,
  COALESCE(SUM(tc.actual_hours), 0)                      AS actual_hours,
  COALESCE(SUM(tc.total_cost), 0)                        AS total_cost,
  COALESCE(SUM(tc.total_revenue), 0)                     AS total_revenue,
  COALESCE(SUM(tc.gross_margin), 0)                      AS gross_margin,
  CASE
    WHEN COALESCE(SUM(tc.total_revenue), 0) = 0 THEN NULL
    ELSE (SUM(tc.gross_margin) / NULLIF(SUM(tc.total_revenue), 0)) * 100
  END                                                    AS gm_pct,
  CASE
    WHEN SUM(tc.estimated_hours) IS NULL OR SUM(tc.estimated_hours) = 0 THEN NULL
    ELSE (SUM(tc.actual_hours) / NULLIF(SUM(tc.estimated_hours), 0)) * 100
  END                                                    AS budget_burn_pct,
  COALESCE(SUM(tc.estimated_hours), 0)                   AS estimated_hours
FROM projects p
LEFT JOIN psa_ticket_costing_v tc
  ON tc.ticket_id IN (
    SELECT id FROM psa_tickets WHERE project_id = p.id
  )
  AND tc.costing_enabled = true
GROUP BY p.id, p.org_id, p.pn, p.name, p.status;

COMMENT ON VIEW psa_project_costing_v IS
  'G6: Per-project rollup of costing-enabled tickets. Used by /org/service/wip (Projects tab).';

-- ----------------------------------------------------------------------------
-- asset_relationships
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE asset_relationship_type AS ENUM (
    'depends_on',
    'contains',
    'powered_by',
    'network_uplink'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS asset_relationships (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  child_asset_id     UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  relationship_type  asset_relationship_type NOT NULL DEFAULT 'depends_on',
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_asset_id, child_asset_id, relationship_type),
  CHECK (parent_asset_id <> child_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_rel_parent ON asset_relationships(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_child ON asset_relationships(child_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_org ON asset_relationships(org_id);

ALTER TABLE asset_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_relationships_org_isolation ON asset_relationships;
CREATE POLICY asset_relationships_org_isolation ON asset_relationships
  FOR ALL
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

COMMENT ON TABLE asset_relationships IS
  'G6: Directed CI graph between assets. Used for impact analysis when creating/resolving tickets.';
