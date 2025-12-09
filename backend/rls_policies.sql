-- backend/rls_policies.sql

-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- =========================
-- SELECT POLICY
-- =========================
CREATE POLICY leads_select_policy
ON leads
FOR SELECT
USING (
  (
    -- Admins: can see all leads in their tenant
    auth.jwt()->>'role' = 'admin'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
  )
  OR
  (
    -- Counselors: can see leads they own OR leads assigned to their team
    auth.jwt()->>'role' = 'counselor'
    AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
    AND (
      owner_id = (auth.jwt()->>'user_id')::uuid
      OR team_id IN (
        SELECT ut.team_id
        FROM user_teams ut
        WHERE ut.user_id = (auth.jwt()->>'user_id')::uuid
      )
    )
  )
);

-- =========================
-- INSERT POLICY
-- =========================
CREATE POLICY leads_insert_policy
ON leads
FOR INSERT
WITH CHECK (
  -- Only admins or counselors can insert
  auth.jwt()->>'role' IN ('admin', 'counselor')
  -- They can only insert leads for their own tenant
  AND tenant_id = (auth.jwt()->>'tenant_id')::uuid
);
