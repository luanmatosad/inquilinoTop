-- O código lê e grava financial_config por organization_id, mas a tabela (migration 000015)
-- só tinha owner_id: todas as rotas de configuração financeira falhavam. Passa o escopo
-- para a organização, como no restante do sistema (ADR rbac-0002).
ALTER TABLE financial_config
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill: organização do usuário dono da configuração.
UPDATE financial_config fc
   SET organization_id = u.organization_id
  FROM users u
 WHERE u.id = fc.owner_id;

-- Linhas sem organização não têm a quem pertencer: ficam inativas em vez de serem apagadas.
UPDATE financial_config SET is_active = false WHERE organization_id IS NULL AND is_active;

-- Mais de uma configuração ativa na mesma organização (usuários diferentes): mantém a mais recente.
UPDATE financial_config fc
   SET is_active = false, updated_at = NOW()
 WHERE fc.is_active
   AND fc.organization_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM financial_config other
      WHERE other.organization_id = fc.organization_id
        AND other.is_active
        AND other.id <> fc.id
        AND (other.updated_at, other.id) > (fc.updated_at, fc.id)
   );

DELETE FROM financial_config WHERE organization_id IS NULL AND NOT EXISTS (
  SELECT 1 FROM payments p WHERE p.financial_config_id = financial_config.id
);

-- Quem cria a configuração passa a ser a organização; owner_id vira legado opcional.
ALTER TABLE financial_config ALTER COLUMN owner_id DROP NOT NULL;

CREATE INDEX idx_financial_config_org ON financial_config(organization_id);

-- Necessário para o ON CONFLICT (organization_id) WHERE is_active = true do upsert.
CREATE UNIQUE INDEX idx_financial_config_org_active_unique
  ON financial_config(organization_id) WHERE is_active = true;
