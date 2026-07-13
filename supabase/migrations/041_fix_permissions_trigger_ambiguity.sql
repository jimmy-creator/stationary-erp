-- Fix "column reference module_key is ambiguous" in initialize_user_permissions().
--
-- The trigger function (migration 010) declared a PL/pgSQL loop variable named
-- module_key, identical to user_permissions.module_key. In the INSERT ... VALUES
-- statement Postgres can't disambiguate the variable from the column and raises
-- 42702, which aborts the INSERT. Because this trigger runs AFTER INSERT ON
-- profiles for every non-admin row, employee-profile creation was failing
-- everywhere (the app upsert AND the auto-create trigger), so new users never
-- got a profiles row and didn't appear in /users.
--
-- Renaming the variable to v_module_key removes the ambiguity. Logic unchanged.
--
-- Run on BOTH stores.

CREATE OR REPLACE FUNCTION public.initialize_user_permissions()
RETURNS TRIGGER AS $$
DECLARE
  modules TEXT[] := ARRAY[
    'products',
    'categories',
    'suppliers',
    'customers',
    'sales',
    'purchase-orders',
    'expenses',
    'employees'
  ];
  v_module_key TEXT;
BEGIN
  IF NEW.role != 'admin' THEN
    FOREACH v_module_key IN ARRAY modules
    LOOP
      INSERT INTO public.user_permissions (user_id, module_key, can_view, can_edit)
      VALUES (NEW.id, v_module_key, true, true)
      ON CONFLICT (user_id, module_key) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
