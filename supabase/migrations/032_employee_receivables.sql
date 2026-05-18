-- Staff (employee) receivables — money owed by employees to the company
-- (salary advances, store credit, fines, etc.). Mirrors the customer
-- opening-balance + customer_payments pattern.
--
-- The employee's opening_balance column itself stays immutable once set;
-- the effective balance is opening_balance - sum(employee_payments).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_date DATE;

CREATE TABLE IF NOT EXISTS employee_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'discount')),
  reference TEXT,
  notes TEXT,
  receipt_number TEXT UNIQUE,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_payments_employee ON employee_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payments_date ON employee_payments(payment_date);

ALTER TABLE employee_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all employee payments" ON employee_payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create employee payments" ON employee_payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update employee payments" ON employee_payments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete employee payments" ON employee_payments FOR DELETE USING (auth.uid() IS NOT NULL);

-- Share the RCT- receipt sequence with sale_payments and customer_payments so
-- receipt numbers stay continuous across every cash collection in the system.
CREATE OR REPLACE FUNCTION generate_employee_payment_receipt_number()
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

DROP TRIGGER IF EXISTS set_employee_payment_receipt_number ON employee_payments;
CREATE TRIGGER set_employee_payment_receipt_number
  BEFORE INSERT ON employee_payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_employee_payment_receipt_number();
