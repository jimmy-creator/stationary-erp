-- Link an HR employee record to a login account so that cash receipts the
-- logged-in user issues (sale_payments / customer_payments) can be attributed
-- to their employee record as "cash custody" in Staff Receivables.
--
-- The link is optional: an HR record can exist without a login, and a login
-- can exist without an HR record. Each auth user can map to at most one
-- employee (enforced by partial unique index).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_auth_user_unique
  ON employees(auth_user_id) WHERE auth_user_id IS NOT NULL;
