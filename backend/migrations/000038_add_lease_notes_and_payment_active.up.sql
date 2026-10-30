ALTER TABLE leases
  ADD COLUMN notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000);

-- Cobranças continuam imutáveis; is_active permite apenas retirar da cobrança
-- as pendentes futuras quando o contrato é encerrado (ver ADR payment-0003).
ALTER TABLE payments
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
