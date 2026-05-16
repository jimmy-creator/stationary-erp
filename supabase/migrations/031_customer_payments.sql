-- Customer-level payment ledger for settling pre-existing opening balances.
-- Unlike sale_payments (tied to a specific invoice), these rows reduce the
-- standalone opening_balance carried into the system at onboarding. The
-- customer's opening_balance column itself stays immutable — the effective
-- AR balance is opening_balance - sum(customer_payments).

CREATE TABLE customer_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'discount')),
  reference TEXT,
  notes TEXT,
  receipt_number TEXT UNIQUE,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX idx_customer_payments_date ON customer_payments(payment_date);

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all customer payments" ON customer_payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create customer payments" ON customer_payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update customer payments" ON customer_payments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete customer payments" ON customer_payments FOR DELETE USING (auth.uid() IS NOT NULL);

-- Share the RCT- receipt sequence with sale_payments so receipt numbers stay
-- continuous across every customer-side cash collection.
CREATE OR REPLACE FUNCTION generate_customer_payment_receipt_number()
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

DROP TRIGGER IF EXISTS set_customer_payment_receipt_number ON customer_payments;
CREATE TRIGGER set_customer_payment_receipt_number
  BEFORE INSERT ON customer_payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_payment_receipt_number();
