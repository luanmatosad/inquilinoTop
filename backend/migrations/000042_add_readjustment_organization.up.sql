-- O código grava e lê lease_readjustments por organization_id, mas a tabela (migration 000012)
-- só tinha owner_id: aplicar e listar reajustes falhava sempre. Passa o escopo para a
-- organização, como no restante do sistema (ADR rbac-0002).
ALTER TABLE lease_readjustments
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill: a organização do contrato reajustado.
UPDATE lease_readjustments r
   SET organization_id = l.organization_id
  FROM leases l
 WHERE l.id = r.lease_id;

ALTER TABLE lease_readjustments ALTER COLUMN organization_id SET NOT NULL;

-- owner_id vira legado opcional: o código novo não o preenche.
ALTER TABLE lease_readjustments ALTER COLUMN owner_id DROP NOT NULL;

CREATE INDEX idx_readjustments_org ON lease_readjustments(organization_id);
