-- Snapshot column: units this sale line has currently contributed to stock.
-- Mirrors purchase_order_items.applied_quantity so sale edits reconcile stock
-- by delta (add/remove/qty-change/cancel) instead of only at create time.
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS applied_quantity NUMERIC;

-- Backfill the forward-consistent baseline: a non-cancelled sale currently has
-- its line quantity deducted from stock; a cancelled sale has nothing applied.
-- (This is the baseline for future deltas — it does not retroactively repair
--  drift from past edits, which is handled by a separate stock correction.)
UPDATE sale_items si
SET applied_quantity = CASE WHEN s.status = 'cancelled' THEN 0 ELSE si.quantity END
FROM sales s
WHERE si.sale_id = s.id
  AND si.applied_quantity IS NULL;
