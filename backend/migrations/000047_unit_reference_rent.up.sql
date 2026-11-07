-- Aluguel de referência da unidade: sugestão de valor ao criar um contrato nela. Opcional.
ALTER TABLE units
    ADD COLUMN reference_rent NUMERIC(12,2) CHECK (reference_rent IS NULL OR reference_rent >= 0);
