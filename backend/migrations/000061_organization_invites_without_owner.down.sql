ALTER TABLE organization_invites DROP CONSTRAINT organization_invites_role_check;
ALTER TABLE organization_invites ADD CONSTRAINT organization_invites_role_check
    CHECK (role IN ('owner', 'admin', 'manager', 'employee', 'viewer'));
