-- Create customers table
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  customer_type TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all customers"
  ON customers FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create customers"
  ON customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update customers"
  ON customers FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete customers"
  ON customers FOR DELETE USING (auth.uid() IS NOT NULL);
