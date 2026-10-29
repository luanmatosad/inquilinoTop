ALTER TABLE tenants
  ADD COLUMN postal_code  TEXT CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'),
  ADD COLUMN address_line TEXT,
  ADD COLUMN city         TEXT,
  ADD COLUMN state        TEXT CHECK (state IS NULL OR char_length(state) = 2),
  ADD COLUMN notes        TEXT;

-- O serviço passa a gravar só dígitos; normaliza o legado antes de checar duplicidade.
UPDATE tenants
   SET document = NULLIF(regexp_replace(document, '[^0-9]', '', 'g'), '')
 WHERE document IS NOT NULL;

DO $$
DECLARE
  dup TEXT;
BEGIN
  SELECT string_agg(organization_id::text || ' / ' || document || ' (' || n || ')', E'\n')
    INTO dup
    FROM (
      SELECT organization_id, document, count(*) AS n
        FROM tenants
       WHERE is_active AND document IS NOT NULL
       GROUP BY organization_id, document
      HAVING count(*) > 1
    ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION E'documentos de inquilino duplicados (organization_id / documento):\n%', dup;
  END IF;
END $$;

CREATE UNIQUE INDEX uq_tenants_org_document_active
  ON tenants (organization_id, document)
  WHERE is_active AND document IS NOT NULL;
