-- Human-readable customer code (e.g. CUST-00001), auto-filled when blank.
-- The UUID `id` stays the foreign-key key; this is a friendly identifier for
-- display, search, and statements. Not tied to any year — customers aren't a
-- yearly document, so the sequence runs flat like the INV-GRY-NNNN invoice format.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := 'CUST-' || LPAD(nextval('customer_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_customer_code ON customers;
CREATE TRIGGER set_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_code();

-- Backfill existing customers in creation order so codes match onboarding sequence.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM customers
  WHERE customer_code IS NULL
)
UPDATE customers c
SET customer_code = 'CUST-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE c.id = numbered.id;

-- Bump the sequence past the backfill so new inserts don't collide.
SELECT setval(
  'customer_code_seq',
  GREATEST(
    (SELECT COUNT(*) FROM customers WHERE customer_code IS NOT NULL),
    1
  ),
  true
);
