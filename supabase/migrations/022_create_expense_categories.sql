CREATE TABLE expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'zinc',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expense categories"
  ON expense_categories FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert expense categories"
  ON expense_categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update expense categories"
  ON expense_categories FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete expense categories"
  ON expense_categories FOR DELETE USING (auth.uid() IS NOT NULL);

-- Seed with existing hardcoded categories
INSERT INTO expense_categories (value, label, color, sort_order) VALUES
  ('rent',           'Rent',             'pink',   1),
  ('utilities',      'Utilities',        'yellow',  2),
  ('salary',         'Salary',           'indigo',  3),
  ('inventory',      'Inventory',        'teal',    4),
  ('maintenance',    'Maintenance',      'orange',  5),
  ('marketing',      'Marketing',        'cyan',    6),
  ('transport',      'Transport',        'amber',   7),
  ('office_supplies','Office Supplies',  'blue',    8),
  ('other',          'Other',            'zinc',    9);
