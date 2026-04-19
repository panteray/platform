-- 053_project_data_fields.sql
-- Adds ~70 project data fields captured from customer spreadsheet templates.
-- Groups: Identity/routing, Status, Dates/aging, RMA/invoicing, Personnel,
-- POC, Program/contract, SSC, Financials, Shipping.

BEGIN;

-- ============================================================================
-- Identity / routing
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pm_comments             TEXT,
  ADD COLUMN IF NOT EXISTS project_type            TEXT,
  ADD COLUMN IF NOT EXISTS vertical                TEXT,
  ADD COLUMN IF NOT EXISTS date_submitted          DATE,
  ADD COLUMN IF NOT EXISTS order_number            TEXT,
  ADD COLUMN IF NOT EXISTS order_date              DATE,
  ADD COLUMN IF NOT EXISTS customer_number         TEXT,
  ADD COLUMN IF NOT EXISTS campus_building_room    TEXT,
  ADD COLUMN IF NOT EXISTS install_address         TEXT;

-- ============================================================================
-- Status (all free text for flexibility — customer-specific workflows)
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ship_status             TEXT,
  ADD COLUMN IF NOT EXISTS operation_status        TEXT,
  ADD COLUMN IF NOT EXISTS signoff_status          TEXT,
  ADD COLUMN IF NOT EXISTS closeout_status         TEXT;

-- ============================================================================
-- Dates / aging
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS approx_install_date     DATE,
  ADD COLUMN IF NOT EXISTS tentative_date          DATE,
  ADD COLUMN IF NOT EXISTS confirmed_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS est_completion_date     DATE,
  ADD COLUMN IF NOT EXISTS actual_equip_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS equip_paid_date         DATE;

-- ============================================================================
-- RMA / invoicing
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS rma_processing_date     DATE,
  ADD COLUMN IF NOT EXISTS rma_number              TEXT,
  ADD COLUMN IF NOT EXISTS invoice_received_date   DATE,
  ADD COLUMN IF NOT EXISTS invoice_number          TEXT,
  ADD COLUMN IF NOT EXISTS invoice_processed_date  DATE,
  ADD COLUMN IF NOT EXISTS sos_sent_date           DATE,
  ADD COLUMN IF NOT EXISTS sos_received_date       DATE,
  ADD COLUMN IF NOT EXISTS quote_received          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS po_sent                 BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Personnel — each role has BOTH an FK to users/subcontractors AND a free-text
-- fallback (so you can capture someone not yet in the system).
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS resource_coordinator_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resource_coordinator_text TEXT,
  ADD COLUMN IF NOT EXISTS technical_supervisor_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS technical_supervisor_text TEXT,
  ADD COLUMN IF NOT EXISTS lead_tech_id            UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS lead_tech_text          TEXT,
  ADD COLUMN IF NOT EXISTS technicians_text        TEXT,
  ADD COLUMN IF NOT EXISTS outside_pm_id           UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS outside_pm_text         TEXT,
  ADD COLUMN IF NOT EXISTS pm_mentor_id            UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS pm_mentor_text          TEXT,
  ADD COLUMN IF NOT EXISTS service_coordinator_id  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS service_coordinator_text TEXT,
  ADD COLUMN IF NOT EXISTS inside_sales_id         UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS inside_sales_text       TEXT,
  ADD COLUMN IF NOT EXISTS outside_sales_id        UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS outside_sales_text      TEXT,
  ADD COLUMN IF NOT EXISTS subcontractor_labor_id  UUID REFERENCES subcontractors(id),
  ADD COLUMN IF NOT EXISTS subcontractor_labor_text TEXT,
  ADD COLUMN IF NOT EXISTS subcontractor_programming_id UUID REFERENCES subcontractors(id),
  ADD COLUMN IF NOT EXISTS subcontractor_programming_text TEXT;

-- ============================================================================
-- Point of contact
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS poc_name                TEXT,
  ADD COLUMN IF NOT EXISTS poc_phone               TEXT,
  ADD COLUMN IF NOT EXISTS poc_email               TEXT;

-- ============================================================================
-- Program / contract
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS erate                   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS program_requirements    TEXT,
  ADD COLUMN IF NOT EXISTS warranty_90_day         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contract_type           TEXT,
  ADD COLUMN IF NOT EXISTS multiple_install_lines  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS multiple_program_lines  BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- SSC (Service/Support Contract)
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS ssc_term_date           DATE,
  ADD COLUMN IF NOT EXISTS ssc_renewal_number      TEXT,
  ADD COLUMN IF NOT EXISTS ssc_block_hours_approved  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS ssc_block_hours_used      NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS ssc_block_hours_remaining NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS ssc_active              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ssc_status              TEXT,
  ADD COLUMN IF NOT EXISTS ssc_duration            TEXT,
  ADD COLUMN IF NOT EXISTS ssc_forced              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ssc_charged             NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ssc_to_finance_invoice  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS satisfaction_survey_sent BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Financials
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS order_amount            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS equipment_cost          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS labor_customer_cost     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS labor_cost_only         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS misc_bom                NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS misc_labor              NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS lift_rental             NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS programming_customer_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS programming_material_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ssc_customer_cost       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ssc_material_cost       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS contingency_amount      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sub_quote_amount        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sub_cost_parts_labor    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS hts_technician_cost     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS job_materials_cost      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS misc_job_costs          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS shipping_cost           NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS project_balance         NUMERIC(12,2);

-- ============================================================================
-- Shipping (distributor covers warehouse/3PL; separate shipping company here)
-- ============================================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS shipping_company        TEXT;

COMMIT;
