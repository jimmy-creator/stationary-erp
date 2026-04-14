-- Add created_by_email to track who created the sale
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_by_email TEXT;
