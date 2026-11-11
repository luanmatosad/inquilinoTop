-- Um usuário pertence a no máximo uma organização.
-- Substitui uq_org_members_one_owner_per_user (000057), que cobria só o papel owner.
DROP INDEX IF EXISTS uq_org_members_one_owner_per_user;
DROP INDEX IF EXISTS idx_org_members_user_id;

CREATE UNIQUE INDEX uq_org_members_one_org_per_user
  ON organization_members (user_id);
