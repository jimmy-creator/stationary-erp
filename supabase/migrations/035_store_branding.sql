-- Add per-store branding fields to store_settings.
-- Logo URL is rendered above the store name on every print view; invoice_header_color
-- drives the accent on invoice/return/receipt table headers (falls back to #4a90c4).

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS invoice_header_color TEXT DEFAULT '#4a90c4';

UPDATE store_settings
SET invoice_header_color = '#4a90c4'
WHERE invoice_header_color IS NULL;
