-- STORE B ONLY — do NOT run on store A.
--
-- Replaces the sales-invoice number trigger to use the 'INV-BTC-' prefix
-- with its own sequence so store B's numbering is independent of store A's.
-- Store A keeps the existing 'INV-GRY-' format from migration 021.

CREATE SEQUENCE IF NOT EXISTS sale_invoice_seq_btc START 1001;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-BTC-' || nextval('sale_invoice_seq_btc')::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
