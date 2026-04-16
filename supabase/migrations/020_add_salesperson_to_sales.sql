-- Add salesperson fields to sales table
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS salesperson_name TEXT;
