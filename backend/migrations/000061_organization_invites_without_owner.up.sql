-- Convite nunca concede owner: a API já rejeita o papel (CreateInviteInput).
-- Linhas owner existentes saem antes da constraint; aceitá-las elevaria privilégio.
DELETE FROM organization_invites WHERE role = 'owner';

ALTER TABLE organization_invites DROP CONSTRAINT organization_invites_role_check;
ALTER TABLE organization_invites ADD CONSTRAINT organization_invites_role_check
    CHECK (role IN ('admin', 'manager', 'employee', 'viewer'));
