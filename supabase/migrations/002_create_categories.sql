-- Create categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all categories"
  ON categories FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create categories"
  ON categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update categories"
  ON categories FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete categories"
  ON categories FOR DELETE USING (auth.uid() IS NOT NULL);

-- Seed default categories
INSERT INTO categories (name, description) VALUES
  ('Pens & Pencils', 'Writing instruments including ballpoint, gel, fountain pens and pencils'),
  ('Notebooks & Paper', 'Notebooks, notepads, loose leaf paper, printer paper'),
  ('Files & Folders', 'Ring binders, folders, file organizers, document holders'),
  ('Art Supplies', 'Colors, brushes, canvases, sketch pads, crayons'),
  ('Office Supplies', 'Staplers, tape, scissors, clips, pins, rubber bands'),
  ('School Supplies', 'Geometry sets, calculators, school bags, lunch boxes'),
  ('Desk Accessories', 'Pen holders, desk organizers, name plates, bookends'),
  ('Printer & Tech', 'Ink cartridges, toners, USB drives, mouse pads'),
  ('Gift & Wrapping', 'Gift wraps, ribbons, greeting cards, gift bags'),
  ('Other', 'Miscellaneous stationery items');
