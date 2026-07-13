-- Allow admins to INSERT profile rows.
--
-- Bug: UserForm.jsx creates the auth user via signUp, then upserts the profile
-- row (INSERT ... ON CONFLICT DO UPDATE) carrying the chosen role. Postgres RLS
-- requires an INSERT policy for an upsert, but migration 001 only defined SELECT
-- and UPDATE policies. So the app's profile write was always rejected — the row
-- only ever appeared because of the on_auth_user_created trigger. Where that
-- trigger was dropped, the new user shows up in Authentication > Users but never
-- gets a profiles row, so it's missing from /users.
--
-- This policy lets the admin who is creating the user write the profile row
-- (with the correct role) directly, matching the existing "Admins can update
-- profiles" policy.
--
-- Run on BOTH stores.

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
