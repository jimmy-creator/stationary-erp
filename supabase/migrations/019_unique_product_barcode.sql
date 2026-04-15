-- Ensure no duplicate barcodes already exist (set duplicates to null before adding constraint)
UPDATE products p1
SET barcode = NULL
WHERE barcode IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM products p2
    WHERE p2.barcode = p1.barcode
      AND p2.id < p1.id
  );

-- Add unique constraint (nulls are not considered duplicates in PostgreSQL)
ALTER TABLE products
  ADD CONSTRAINT products_barcode_unique UNIQUE (barcode);
