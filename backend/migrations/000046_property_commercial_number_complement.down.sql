-- Falha de propósito se houver imóveis COMMERCIAL: não apagamos nem convertemos dados em silêncio.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM properties WHERE type = 'COMMERCIAL') THEN
        RAISE EXCEPTION 'não é possível reverter 000046: existem imóveis COMMERCIAL';
    END IF;
END $$;

ALTER TABLE properties DROP COLUMN IF EXISTS complement, DROP COLUMN IF EXISTS number;

ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_type_check;
ALTER TABLE properties
    ADD CONSTRAINT properties_type_check CHECK (type IN ('RESIDENTIAL', 'SINGLE'));
