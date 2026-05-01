-- Track per-line applied state so retroactive PO edits (qty, price, tax, cargo,
-- product, deletion) can be reconciled against stock count and weighted-average
-- cost price by computing a delta against what was previously applied.
--
-- applied_quantity:    units this line has contributed to stock so far.
-- applied_landed_cost: per-unit landed cost (incl. its share of tax + cargo)
--                      at the time of the last apply.
ALTER TABLE IF EXISTS purchase_order_items
  ADD COLUMN IF NOT EXISTS applied_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_landed_cost NUMERIC(14, 4) NOT NULL DEFAULT 0;

-- Backfill any line whose parent PO was already 'received' before this migration.
-- Use the line's full quantity and a best-effort landed cost (price share + tax +
-- cargo share). This is what the receive flow would have computed at the time.
UPDATE purchase_order_items pi
SET applied_quantity = pi.quantity,
    applied_landed_cost = CASE
      WHEN COALESCE(pi.quantity, 0) = 0 THEN 0
      ELSE
        (pi.total_price
         + (pi.total_price * COALESCE(po.tax_percentage, 0) / 100)
         + COALESCE(
             (pi.total_price / NULLIF(
               (SELECT SUM(total_price) FROM purchase_order_items WHERE po_id = po.id),
               0
             )) * COALESCE(po.cargo_charges, 0),
             0
           )
        ) / pi.quantity
    END
FROM purchase_orders po
WHERE pi.po_id = po.id
  AND po.status = 'received'
  AND pi.applied_quantity = 0;
