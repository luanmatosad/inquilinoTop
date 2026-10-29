-- Requer a extensão btree_gist (contrib). Se o Postgres gerenciado não a oferecer,
-- aplicar o fallback do design: serializar a criação com SELECT ... FOR UPDATE na unidade.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Aborta listando contratos ativos sobrepostos em vez de alterar dados.
DO $$
DECLARE
  dup TEXT;
BEGIN
  SELECT string_agg(a.unit_id::text || ': ' || a.id::text || ' x ' || b.id::text, E'\n')
    INTO dup
    FROM leases a
    JOIN leases b
      ON a.unit_id = b.unit_id AND a.id < b.id
   WHERE a.status = 'ACTIVE' AND a.is_active
     AND b.status = 'ACTIVE' AND b.is_active
     AND daterange(a.start_date, a.end_date, '[]') && daterange(b.start_date, b.end_date, '[]');
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION E'contratos ativos sobrepostos (unit_id: contrato x contrato):\n%', dup;
  END IF;
END $$;

ALTER TABLE leases
  ADD CONSTRAINT leases_no_overlap_per_unit
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status = 'ACTIVE' AND is_active);
