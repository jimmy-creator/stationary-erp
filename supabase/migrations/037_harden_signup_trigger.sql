-- Harden the auth.users → profiles trigger so a profile-insert failure can never
-- abort the Supabase signUp flow. The app (UserForm.jsx) upserts profiles
-- explicitly after signUp, so this trigger is only a convenience for first-user
-- self-signups. Without these guards, certain Supabase project configs surface
-- "Database error creating new user" instead of the real cause.
--
-- Run on BOTH stores.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'employee')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth.users insert; the app will create/repair the profile.
  RETURN NEW;
END;
$$;

-- Trigger itself stays exactly as defined in migration 001.
