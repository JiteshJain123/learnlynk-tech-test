-- backend/schema.sql

-- (Optional) Ensure gen_random_uuid is available (Supabase usually has this enabled)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- LEADS
-- =========================
CREATE TABLE IF NOT EXISTS leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  owner_id    uuid NOT NULL,           -- counselor user id
  team_id     uuid,                    -- team to which lead is assigned
  name        text NOT NULL,
  email       text,
  stage       text NOT NULL DEFAULT 'new',  -- e.g. new, contacted, qualified, etc.
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- =========================
-- APPLICATIONS
-- =========================
CREATE TABLE IF NOT EXISTS applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  lead_id     uuid NOT NULL,         -- FK to leads.id
  program     text,                  -- e.g. program/course name
  status      text NOT NULL DEFAULT 'draft',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  CONSTRAINT fk_applications_lead
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE CASCADE
);

-- =========================
-- TASKS
-- =========================
CREATE TABLE IF NOT EXISTS tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  application_id uuid NOT NULL,        -- FK to applications.id
  title          text NOT NULL,
  type           text NOT NULL,        -- call | email | review
  status         text NOT NULL DEFAULT 'pending', -- pending | completed
  due_at         timestamptz NOT NULL,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),

  CONSTRAINT fk_tasks_application
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE,

  -- Check task type constraint
  CONSTRAINT tasks_type_check
    CHECK (type IN ('call', 'email', 'review')),

  -- due_at must be >= created_at
  CONSTRAINT tasks_due_at_check
    CHECK (due_at >= created_at)
);

-- =========================
-- OPTIONAL SUPPORTING TABLES
-- =========================
-- (These are assumed for RLS, but not strictly required here)
CREATE TABLE IF NOT EXISTS teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  name       text NOT NULL
);

CREATE TABLE IF NOT EXISTS user_teams (
  user_id  uuid NOT NULL,
  team_id  uuid NOT NULL,
  PRIMARY KEY (user_id, team_id)
);

-- =========================
-- INDEXES
-- =========================

-- LEADS: common queries by owner, stage, created_at (and tenant)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_owner_stage_created
  ON leads (tenant_id, owner_id, stage, created_at);

-- Sometimes you might want separate indexes:
CREATE INDEX IF NOT EXISTS idx_leads_owner
  ON leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage
  ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads (created_at);

-- APPLICATIONS: by tenant and lead
CREATE INDEX IF NOT EXISTS idx_applications_tenant_lead
  ON applications (tenant_id, lead_id);

-- TASKS: by tenant, due_at, status
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due_at_status
  ON tasks (tenant_id, due_at, status);

-- Query: tasks due today is fast thanks to tenant_id + due_at index.
