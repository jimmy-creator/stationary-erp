-- Purchase Returns: goods returned to a supplier (against an existing PO or
-- ad-hoc). Mirrors purchase_orders/purchase_order_items shape with
-- per-line `applied_quantity` and `applied_landed_cost` so retroactive edits
-- can compute deltas against stock and the weighted-average cost price.

CREATE TABLE purchase_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number TEXT UNIQUE NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,

  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,

  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,

  -- How the supplier is making us whole.
  --   cash / bank_transfer  -> immediate refund into a cash account
  --   debit_note            -> applied against the parent PO's outstanding balance
  refund_method TEXT DEFAULT 'debit_note' CHECK (refund_method IN ('cash', 'bank_transfer', 'debit_note')),
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

CREATE TABLE purchase_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID REFERENCES purchase_returns(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit TEXT DEFAULT 'Pcs',
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Snapshotted per-unit landed cost used when removing this line's units
  -- from stock. Mirrors purchase_order_items.applied_landed_cost so the same
  -- weighted-average reversal math works in both directions.
  applied_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  applied_landed_cost NUMERIC(14, 4) NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE SEQUENCE purchase_return_seq START 1;

CREATE OR REPLACE FUNCTION generate_purchase_return_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
    NEW.return_number := 'PR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('purchase_return_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_purchase_return_number
  BEFORE INSERT ON purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION generate_purchase_return_number();

CREATE OR REPLACE FUNCTION update_purchase_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_returns_updated_at
  BEFORE UPDATE ON purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_returns_updated_at();

CREATE INDEX idx_purchase_returns_po ON purchase_returns(po_id);
CREATE INDEX idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX idx_purchase_returns_date ON purchase_returns(return_date);
CREATE INDEX idx_purchase_returns_status ON purchase_returns(status);
CREATE INDEX idx_purchase_return_items_return ON purchase_return_items(return_id);
CREATE INDEX idx_purchase_return_items_product ON purchase_return_items(product_id);
CREATE INDEX idx_purchase_return_items_po_item ON purchase_return_items(po_item_id);

ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all purchase returns" ON purchase_returns FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create purchase returns" ON purchase_returns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update purchase returns" ON purchase_returns FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete purchase returns" ON purchase_returns FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view all purchase return items" ON purchase_return_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create purchase return items" ON purchase_return_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update purchase return items" ON purchase_return_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete purchase return items" ON purchase_return_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- Allow po_payments to record debit notes from purchase returns. A debit_note
-- payment row represents a return applied against the parent PO's balance
-- instead of a cash refund.
ALTER TABLE po_payments DROP CONSTRAINT IF EXISTS po_payments_payment_method_check;
ALTER TABLE po_payments ADD CONSTRAINT po_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'debit_note'));
