-- Create sale_payments table for tracking payment collections
CREATE TABLE sale_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer')),
  reference TEXT,
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX idx_sale_payments_date ON sale_payments(payment_date);

-- Enable RLS
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all sale payments" ON sale_payments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create sale payments" ON sale_payments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update sale payments" ON sale_payments FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete sale payments" ON sale_payments FOR DELETE USING (auth.uid() IS NOT NULL);
