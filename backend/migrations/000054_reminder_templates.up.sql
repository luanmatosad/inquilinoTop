-- Lembretes de cobrança da organização (nome, dias em relação ao vencimento e texto com variáveis).
-- Salvar a lista desativa os lembretes ativos e cria os novos (sem DELETE: o histórico fica).
CREATE TABLE reminder_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    offset_days     INTEGER NOT NULL CHECK (offset_days BETWEEN -30 AND 60),
    body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at  TIMESTAMPTZ
);

-- Um lembrete ativo por organização e número de dias.
CREATE UNIQUE INDEX uq_reminder_templates_active_offset ON reminder_templates (organization_id, offset_days) WHERE is_active;
CREATE INDEX idx_reminder_templates_org ON reminder_templates (organization_id) WHERE is_active;
