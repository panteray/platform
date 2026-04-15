-- 049_psa_ticket_completion_capture.sql
-- Phase 7A Mobile Tech: capture customer signature + geolocation at ticket completion.
-- Adds 4 columns to psa_tickets. Storage bucket `psa-ticket-photos` must be created
-- in the Supabase dashboard (Storage → New Bucket → public, restrict by RLS).

ALTER TABLE psa_tickets
  ADD COLUMN IF NOT EXISTS completion_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS completion_lat             NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS completion_lng             NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS completion_captured_at     TIMESTAMPTZ;

COMMENT ON COLUMN psa_tickets.completion_signature_data IS 'Base64 PNG canvas signature captured at COMPLETED→RESOLVED transition.';
COMMENT ON COLUMN psa_tickets.completion_lat IS 'Latitude captured at completion via navigator.geolocation.';
COMMENT ON COLUMN psa_tickets.completion_lng IS 'Longitude captured at completion via navigator.geolocation.';
COMMENT ON COLUMN psa_tickets.completion_captured_at IS 'When signature + geo were captured.';

-- NOTE: `psa-ticket-photos` storage bucket must be created manually in Supabase
-- dashboard. Panteray convention: public bucket, paths scoped by org_id/ticket_id.
-- Path format: {org_id}/{ticket_id}/{uuid}.{ext}
