-- Track which PO line items have already had their stock bump applied,
-- so adding new lines to an already-received PO can apply just the new lines.
ALTER TABLE IF EXISTS purchase_order_items
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;

-- Backfill: any items belonging to a PO already marked 'received' are treated
-- as already-applied (use the PO's updated_at as a best-effort timestamp).
UPDATE purchase_order_items pi
SET received_at = po.updated_at
FROM purchase_orders po
WHERE pi.po_id = po.id
  AND po.status = 'received'
  AND pi.received_at IS NULL;
