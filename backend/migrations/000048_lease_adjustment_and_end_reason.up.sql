-- Índice e mês de reajuste, e motivo do encerramento. Todas opcionais; sem índice = sem reajuste automático definido.
ALTER TABLE leases
    ADD COLUMN adjustment_index VARCHAR(10) CHECK (adjustment_index IN ('IGP-M', 'IPCA')),
    ADD COLUMN adjustment_month SMALLINT    CHECK (adjustment_month BETWEEN 1 AND 12),
    ADD COLUMN end_reason       VARCHAR(30) CHECK (end_reason IN ('TERM_END', 'TENANT_REQUEST', 'NONPAYMENT', 'OWNER_REQUEST', 'OTHER'));

-- Contratos existentes passam a reajustar no mês em que começaram (aniversário do contrato).
UPDATE leases SET adjustment_month = EXTRACT(MONTH FROM start_date)::smallint WHERE adjustment_month IS NULL;
