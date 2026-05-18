-- Capital movements (owner injections / withdrawals) and fixed-asset
-- purchases. Both flow through cash/bank like every other money event, so
-- Cash Accounts and Daily Cash can sum them into the running totals.

CREATE TABLE IF NOT EXISTS capital_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque')),
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_movements_date ON capital_movements(movement_date);

ALTER TABLE capital_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view capital movements" ON capital_movements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert capital movements" ON capital_movements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update capital movements" ON capital_movements FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete capital movements" ON capital_movements FOR DELETE USING (auth.uid() IS NOT NULL);


CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cost NUMERIC(12, 2) NOT NULL CHECK (cost >= 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque')),
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_date ON fixed_assets(purchase_date);

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view fixed assets" ON fixed_assets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert fixed assets" ON fixed_assets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update fixed assets" ON fixed_assets FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete fixed assets" ON fixed_assets FOR DELETE USING (auth.uid() IS NOT NULL);
