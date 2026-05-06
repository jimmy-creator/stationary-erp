-- Allow sale_payments to record settlement discounts written off when
-- collecting on an outstanding sale. A 'discount' payment row reduces the
-- sale's outstanding balance without representing actual cash collected.
ALTER TABLE sale_payments DROP CONSTRAINT IF EXISTS sale_payments_payment_method_check;
ALTER TABLE sale_payments ADD CONSTRAINT sale_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'credit_note', 'discount'));
