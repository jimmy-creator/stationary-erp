-- Auto-numbered receipts for AR collections and AP vendor payments.
-- Only cash-equivalent methods get a receipt; credit_note and discount entries
-- on AR and debit_note entries on AP are paper-only adjustments and stay NULL.

-- ─── Customer payment receipts (sale_payments) ────────────────────────────
ALTER TABLE sale_payments ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq START 1;

CREATE OR REPLACE FUNCTION generate_payment_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    IF NEW.payment_method IN ('cash', 'card', 'bank_transfer') THEN
      NEW.receipt_number := 'RCT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('payment_receipt_seq')::TEXT, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payment_receipt_number ON sale_payments;
CREATE TRIGGER set_payment_receipt_number
  BEFORE INSERT ON sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_payment_receipt_number();

-- Backfill existing cash-equivalent rows in chronological order.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn,
         TO_CHAR(created_at, 'YYYY') AS yr
  FROM sale_payments
  WHERE receipt_number IS NULL
    AND payment_method IN ('cash', 'card', 'bank_transfer')
)
UPDATE sale_payments sp
SET receipt_number = 'RCT-' || numbered.yr || '-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE sp.id = numbered.id;

-- Bump the sequence past the backfill so new inserts don't collide.
SELECT setval(
  'payment_receipt_seq',
  GREATEST(
    (SELECT COUNT(*) FROM sale_payments WHERE receipt_number IS NOT NULL),
    1
  ),
  true
);

-- ─── Vendor payment receipts (po_payments) ────────────────────────────────
ALTER TABLE po_payments ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS vendor_payment_receipt_seq START 1;

CREATE OR REPLACE FUNCTION generate_vendor_payment_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    IF NEW.payment_method IN ('cash', 'bank_transfer', 'cheque') THEN
      NEW.receipt_number := 'VPR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('vendor_payment_receipt_seq')::TEXT, 5, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_vendor_payment_receipt_number ON po_payments;
CREATE TRIGGER set_vendor_payment_receipt_number
  BEFORE INSERT ON po_payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_vendor_payment_receipt_number();

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn,
         TO_CHAR(created_at, 'YYYY') AS yr
  FROM po_payments
  WHERE receipt_number IS NULL
    AND payment_method IN ('cash', 'bank_transfer', 'cheque')
)
UPDATE po_payments pp
SET receipt_number = 'VPR-' || numbered.yr || '-' || LPAD(numbered.rn::TEXT, 5, '0')
FROM numbered
WHERE pp.id = numbered.id;

SELECT setval(
  'vendor_payment_receipt_seq',
  GREATEST(
    (SELECT COUNT(*) FROM po_payments WHERE receipt_number IS NOT NULL),
    1
  ),
  true
);
