-- Migration 060: Project Documents
-- Adds:
--   * project_doc_type enum (5 supported document types — Kickoff dropped per design)
--   * doc_templates table (org-level template body per doc_type)
--   * project_documents table (per-project generated artifact metadata)
--
-- Storage bucket "project-documents" must be created separately in the
-- Supabase Dashboard → Storage. Path convention: {org_id}/{project_id}/{filename}.

-- =====================================================================
-- 1. Enums
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE project_doc_type AS ENUM (
    'welcome_email',
    'project_workbook',
    'install_reminder',
    'sign_off_sheet',
    'change_order_form'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 2. doc_templates — one row per (org, doc_type)
-- =====================================================================

CREATE TABLE IF NOT EXISTS doc_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type    project_doc_type NOT NULL,
  name        text NOT NULL,
  body_md     text NOT NULL DEFAULT '',
  variables   jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_org ON doc_templates(org_id);

ALTER TABLE doc_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_templates org access" ON doc_templates;
CREATE POLICY "doc_templates org access"
  ON doc_templates
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- =====================================================================
-- 3. project_documents — per-project generated artifacts
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type      project_doc_type NOT NULL,
  version       integer NOT NULL,
  filename      text NOT NULL,
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  byte_size     integer,
  generated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, doc_type, version)
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_org     ON project_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_type    ON project_documents(project_id, doc_type, version DESC);

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_documents org access" ON project_documents;
CREATE POLICY "project_documents org access"
  ON project_documents
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- =====================================================================
-- 4. updated_at trigger for doc_templates
-- =====================================================================

CREATE OR REPLACE FUNCTION set_updated_at_doc_templates()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doc_templates_updated_at ON doc_templates;
CREATE TRIGGER trg_doc_templates_updated_at
  BEFORE UPDATE ON doc_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_doc_templates();
