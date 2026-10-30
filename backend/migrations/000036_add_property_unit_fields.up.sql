ALTER TABLE properties
  ADD COLUMN postal_code  TEXT CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'),
  ADD COLUMN neighborhood TEXT;

ALTER TABLE units
  ADD COLUMN area_m2    NUMERIC(10,2) CHECK (area_m2 IS NULL OR area_m2 > 0),
  ADD COLUMN bedrooms   INTEGER CHECK (bedrooms IS NULL OR bedrooms >= 0),
  ADD COLUMN bathrooms  INTEGER CHECK (bathrooms IS NULL OR bathrooms >= 0);

-- Aborta listando duplicidades legadas em vez de apagar ou renomear dados.
DO $$
DECLARE
  dup TEXT;
BEGIN
  SELECT string_agg(property_id::text || ' / ' || lbl || ' (' || n || ')', E'\n')
    INTO dup
    FROM (
      SELECT property_id, lower(label) AS lbl, count(*) AS n
        FROM units
       WHERE is_active
       GROUP BY property_id, lower(label)
      HAVING count(*) > 1
    ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION E'rótulos de unidade duplicados (property_id / rótulo):\n%', dup;
  END IF;
END $$;

CREATE UNIQUE INDEX uq_units_property_label_active
  ON units (property_id, lower(label))
  WHERE is_active;
