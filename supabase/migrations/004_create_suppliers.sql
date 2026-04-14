-- Create suppliers table
CREATE TABLE suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  vat_number TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all suppliers"
  ON suppliers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create suppliers"
  ON suppliers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update suppliers"
  ON suppliers FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete suppliers"
  ON suppliers FOR DELETE USING (auth.uid() IS NOT NULL);
