-- Create expenses table
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  payment_method TEXT DEFAULT 'cash',
  reference_number TEXT,
  vendor TEXT,
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all expenses" ON expenses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update expenses" ON expenses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete expenses" ON expenses FOR DELETE USING (auth.uid() IS NOT NULL);
