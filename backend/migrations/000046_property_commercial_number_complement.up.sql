-- COMMERCIAL: imóvel comercial multiunidade (como RESIDENTIAL, não cria unidade automática).
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_type_check;
ALTER TABLE properties
    ADD CONSTRAINT properties_type_check CHECK (type IN ('RESIDENTIAL', 'COMMERCIAL', 'SINGLE'));

-- Número e complemento do endereço, opcionais e sem backfill.
ALTER TABLE properties
    ADD COLUMN number     VARCHAR(20),
    ADD COLUMN complement VARCHAR(100);
