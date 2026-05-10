-- Customer opening balance — captures pre-existing AR (or credit) at the
-- moment the customer is onboarded into this system. Positive = customer
-- owes us (debit); negative = we owe customer (credit on file).
--
-- Surfaced on the customer statement as a synthetic ledger row dated
-- opening_balance_date so the closing balance, period filter, and aging
-- buckets reconcile naturally. Not tied to any invoice.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
