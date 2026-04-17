-- New sequence starting at 1001 for the new invoice format
CREATE SEQUENCE IF NOT EXISTS sale_invoice_seq_v2 START 1001;

-- Update the trigger function to use new format: INV-GRY-1001
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-GRY-' || nextval('sale_invoice_seq_v2')::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
