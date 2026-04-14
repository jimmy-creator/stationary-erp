-- Create po_payments table for tracking payments to suppliers
CREATE TABLE po_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque')),
  reference TEXT,
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_po_payments_po ON po_payments(po_id);
CREATE INDEX idx_po_payments_date ON po_payments(payment_date);

ALTER TABLE po_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all po payments" ON po_payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create po payments" ON po_payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update po payments" ON po_payments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete po payments" ON po_payments FOR DELETE USING (auth.uid() IS NOT NULL);

-- Add payment tracking columns to purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;
