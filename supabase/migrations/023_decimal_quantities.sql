-- Allow decimal quantities for products and transaction line items.
-- Uses ALTER TABLE IF EXISTS so the migration does not fail when an optional
-- table (e.g. stock_adjustments) is not yet present in the target database.
ALTER TABLE IF EXISTS products
  ALTER COLUMN stock_quantity TYPE NUMERIC(14, 3) USING stock_quantity::NUMERIC,
  ALTER COLUMN stock_quantity SET DEFAULT 0;

ALTER TABLE IF EXISTS purchase_order_items
  ALTER COLUMN quantity TYPE NUMERIC(14, 3) USING quantity::NUMERIC,
  ALTER COLUMN quantity SET DEFAULT 1;

ALTER TABLE IF EXISTS sale_items
  ALTER COLUMN quantity TYPE NUMERIC(14, 3) USING quantity::NUMERIC,
  ALTER COLUMN quantity SET DEFAULT 1;

ALTER TABLE IF EXISTS stock_adjustments
  ALTER COLUMN quantity TYPE NUMERIC(14, 3) USING quantity::NUMERIC,
  ALTER COLUMN previous_stock TYPE NUMERIC(14, 3) USING previous_stock::NUMERIC,
  ALTER COLUMN new_stock TYPE NUMERIC(14, 3) USING new_stock::NUMERIC;
