-- Stock adjustments log
CREATE TABLE stock_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'remove', 'set')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stock_adjustments_product ON stock_adjustments(product_id);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock adjustments" ON stock_adjustments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create stock adjustments" ON stock_adjustments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
