ALTER TABLE leases
  ADD COLUMN notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000);
