DROP INDEX IF EXISTS uq_org_members_one_org_per_user;

CREATE INDEX idx_org_members_user_id ON organization_members (user_id);
CREATE UNIQUE INDEX uq_org_members_one_owner_per_user
  ON organization_members (user_id) WHERE role = 'owner';
