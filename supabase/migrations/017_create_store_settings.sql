CREATE TABLE store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT DEFAULT 'My Store',
  address TEXT,
  phone TEXT,
  email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read store settings" ON store_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone authenticated can update store settings" ON store_settings FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone authenticated can insert store settings" ON store_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default row
INSERT INTO store_settings (store_name, address, phone, email)
VALUES ('My Stationery Store', '', '', '');
