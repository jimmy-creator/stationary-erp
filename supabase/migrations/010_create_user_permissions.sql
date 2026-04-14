-- User Permissions table for granular module access control
CREATE TABLE user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_key)
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permissions"
  ON user_permissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert permissions"
  ON user_permissions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update permissions"
  ON user_permissions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete permissions"
  ON user_permissions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_module ON user_permissions(module_key);

-- Function to initialize default permissions for new users
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
  module_key TEXT;
BEGIN
  IF NEW.role != 'admin' THEN
    FOREACH module_key IN ARRAY modules
    LOOP
      INSERT INTO public.user_permissions (user_id, module_key, can_view, can_edit)
      VALUES (NEW.id, module_key, true, true)
      ON CONFLICT (user_id, module_key) DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.initialize_user_permissions();
