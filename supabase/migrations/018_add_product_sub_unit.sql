-- Add sub-unit support to products
-- e.g. Base unit: Box, Secondary unit: Pieces, 1 Box = 12 Pieces

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS secondary_unit TEXT,
  ADD COLUMN IF NOT EXISTS unit_conversion NUMERIC(10, 4);

COMMENT ON COLUMN products.secondary_unit IS 'e.g. Pieces, Pcs — the smaller unit within one base unit';
COMMENT ON COLUMN products.unit_conversion IS 'How many secondary units make one base unit (e.g. 12 means 1 Box = 12 Pieces)';
