-- ============================================================================
-- Migration 041 — PSA Post-Incident Report (PIR) fields + KEDB expiry helpers
-- G7: P1/P2 closeout gate + KEDB 6-month auto-archive sweep
-- ============================================================================

-- ---------- PIR fields on psa_tickets ----------
ALTER TABLE psa_tickets
  ADD COLUMN IF NOT EXISTS pir_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pir_root_cause TEXT,
  ADD COLUMN IF NOT EXISTS pir_timeline TEXT,
  ADD COLUMN IF NOT EXISTS pir_lessons_learned TEXT,
  ADD COLUMN IF NOT EXISTS pir_action_items TEXT;

COMMENT ON COLUMN psa_tickets.pir_completed_at IS 'Post-incident report completion timestamp. Required for P1/P2 tickets at RESOLVED transition.';

-- ---------- Active KEDB view (non-archived + not expired) ----------
CREATE OR REPLACE VIEW psa_kedb_active_v AS
SELECT *
FROM psa_kedb_entries
WHERE archived_at IS NULL
  AND expires_at > NOW();

COMMENT ON VIEW psa_kedb_active_v IS 'KEDB entries still valid for matching: not archived, not past 6-month expiry.';
