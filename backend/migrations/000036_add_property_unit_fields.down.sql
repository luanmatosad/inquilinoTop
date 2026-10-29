DROP INDEX IF EXISTS uq_units_property_label_active;

ALTER TABLE units
  DROP COLUMN IF EXISTS bathrooms,
  DROP COLUMN IF EXISTS bedrooms,
  DROP COLUMN IF EXISTS area_m2;

ALTER TABLE properties
  DROP COLUMN IF EXISTS neighborhood,
  DROP COLUMN IF EXISTS postal_code;
