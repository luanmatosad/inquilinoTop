-- Um usuário é owner de no máximo uma organização.
-- Pré-requisito: não existem owners duplicados (verificado antes desta migration).
CREATE UNIQUE INDEX uq_org_members_one_owner_per_user
  ON organization_members (user_id) WHERE role = 'owner';
