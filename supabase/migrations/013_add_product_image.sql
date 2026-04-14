-- Add image_url column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
