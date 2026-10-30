ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_no_overlap_per_unit;
-- A extensão btree_gist é mantida: outras migrations ou objetos podem depender dela.
