-- Stores per-equipment evidence collected during a lab audit.
-- One row per (lab_id, equipment_name) pair. Run once on the Supabase database.

CREATE TABLE IF NOT EXISTS lab_audit_evidence (
  id           BIGSERIAL PRIMARY KEY,
  lab_id       INTEGER     NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  equipment_name TEXT      NOT NULL,
  verified     BOOLEAN     NOT NULL DEFAULT FALSE,
  proof_url    TEXT,
  proof_type   TEXT        CHECK (proof_type IN ('photo', 'document')),
  proof_name   TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lab_id, equipment_name)
);

CREATE INDEX IF NOT EXISTS lab_audit_evidence_lab_id_idx ON lab_audit_evidence (lab_id);
