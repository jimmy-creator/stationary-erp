-- Create employees table
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  department TEXT,
  salary DECIMAL(12,2),
  currency TEXT DEFAULT 'SAR',
  hire_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sequence for employee number
CREATE SEQUENCE employee_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_number IS NULL OR NEW.employee_number = '' THEN
    NEW.employee_number := 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_employee_number
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION generate_employee_number();

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all employees" ON employees FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create employees" ON employees FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update employees" ON employees FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete employees" ON employees FOR DELETE USING (auth.uid() IS NOT NULL);
