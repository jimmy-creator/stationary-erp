-- Sales Returns: customer returns issued against an existing sale (or ad-hoc).
-- Mirrors the sales/sale_items shape with the addition of a per-line `restock`
-- flag (false for damaged goods that should not re-enter inventory) and
-- `applied_quantity` so retroactive edits can be reconciled against stock by
-- computing a delta against what was previously applied.

CREATE TABLE sales_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number TEXT UNIQUE NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,

  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,

  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,

  -- How the customer is being made whole.
  --   cash / card / bank_transfer  -> immediate refund out of a cash account
  --   credit_note                  -> applied against the parent sale's balance
  refund_method TEXT DEFAULT 'cash' CHECK (refund_method IN ('cash', 'card', 'bank_transfer', 'credit_note')),
  refund_status TEXT DEFAULT 'refunded' CHECK (refund_status IN ('refunded', 'pending')),
  amount_refunded DECIMAL(12,2) DEFAULT 0,

  reason TEXT,
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),

  created_by UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sales_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID REFERENCES sales_returns(id) ON DELETE CASCADE,
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- false = damaged / write-off; do not return units to stock.
  restock BOOLEAN NOT NULL DEFAULT TRUE,

  -- units this line has currently contributed back to stock; allows delta
  -- reconciliation on edit (mirrors purchase_order_items.applied_quantity).
  applied_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE SEQUENCE sales_return_seq START 1;

CREATE OR REPLACE FUNCTION generate_sales_return_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
    NEW.return_number := 'CR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('sales_return_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sales_return_number
  BEFORE INSERT ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION generate_sales_return_number();

CREATE OR REPLACE FUNCTION update_sales_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_returns_updated_at
  BEFORE UPDATE ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_returns_updated_at();

CREATE INDEX idx_sales_returns_sale ON sales_returns(sale_id);
CREATE INDEX idx_sales_returns_customer ON sales_returns(customer_id);
CREATE INDEX idx_sales_returns_date ON sales_returns(return_date);
CREATE INDEX idx_sales_returns_status ON sales_returns(status);
CREATE INDEX idx_sales_return_items_return ON sales_return_items(return_id);
CREATE INDEX idx_sales_return_items_product ON sales_return_items(product_id);
CREATE INDEX idx_sales_return_items_sale_item ON sales_return_items(sale_item_id);

ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all sales returns" ON sales_returns FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create sales returns" ON sales_returns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update sales returns" ON sales_returns FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete sales returns" ON sales_returns FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view all sales return items" ON sales_return_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create sales return items" ON sales_return_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update sales return items" ON sales_return_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete sales return items" ON sales_return_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- Allow sale_payments to record credit notes from returns. A credit_note
-- payment row represents a sales_return applied against the parent sale's
-- balance instead of being refunded as cash.
ALTER TABLE sale_payments DROP CONSTRAINT IF EXISTS sale_payments_payment_method_check;
ALTER TABLE sale_payments ADD CONSTRAINT sale_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'credit_note'));
