-- Despesas existentes ficam PENDING; o usuário baixa as já pagas (há baixa em lote na tela).
-- LATE não é persistido: é derivado na leitura (PENDING e vencida).
ALTER TABLE expenses
  ADD COLUMN status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
  ADD COLUMN paid_date   DATE,
  ADD COLUMN paid_amount FLOAT8 CHECK (paid_amount IS NULL OR paid_amount > 0),
  ADD CONSTRAINT expenses_paid_fields_consistent CHECK (
    (status = 'PAID'    AND paid_date IS NOT NULL AND paid_amount IS NOT NULL) OR
    (status = 'PENDING' AND paid_date IS NULL     AND paid_amount IS NULL)
  );

CREATE INDEX idx_expenses_org_status_due ON expenses (organization_id, status, due_date) WHERE is_active;
