-- Regras financeiras da organização (padrões para novos contratos e janela do aviso de reajuste).
CREATE TABLE organization_settings (
    organization_id          UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    late_fee_percent         NUMERIC(5,2) NOT NULL DEFAULT 2   CHECK (late_fee_percent BETWEEN 0 AND 10),
    monthly_interest_percent NUMERIC(5,2) NOT NULL DEFAULT 1   CHECK (monthly_interest_percent BETWEEN 0 AND 5),
    default_adjustment_index TEXT         NOT NULL DEFAULT 'IGP-M' CHECK (default_adjustment_index IN ('IGP-M', 'IPCA')),
    readjust_notice_days     INTEGER      NOT NULL DEFAULT 60  CHECK (readjust_notice_days BETWEEN 1 AND 180),
    updated_by               UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Aproveita os padrões antigos (guardados em financial_config.config, que nada lia), só quando são números
-- dentro da faixa permitida; o resto fica no padrão. CASE aninhado: o cast só roda depois da checagem do formato.
INSERT INTO organization_settings (organization_id, late_fee_percent, monthly_interest_percent)
SELECT fc.organization_id,
       CASE WHEN fc.config->>'default_late_fee' ~ '^[0-9]+(\.[0-9]+)?$'
            THEN CASE WHEN (fc.config->>'default_late_fee')::numeric BETWEEN 0 AND 10 THEN (fc.config->>'default_late_fee')::numeric ELSE 2 END
            ELSE 2 END,
       CASE WHEN fc.config->>'default_interest' ~ '^[0-9]+(\.[0-9]+)?$'
            THEN CASE WHEN (fc.config->>'default_interest')::numeric BETWEEN 0 AND 5 THEN (fc.config->>'default_interest')::numeric ELSE 1 END
            ELSE 1 END
  FROM financial_config fc
 WHERE fc.is_active AND fc.organization_id IS NOT NULL
ON CONFLICT (organization_id) DO NOTHING;
