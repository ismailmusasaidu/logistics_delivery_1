/*
  # Corporate Logistics System

  ## Overview
  This migration creates a comprehensive corporate logistics management system with multi-role access,
  approval workflows, departmental organization, and financial reporting capabilities.

  ## 1. New Tables
  
  ### `companies`
  Corporate entities that use the logistics platform
  - `id` (uuid, primary key)
  - `name` (text) - Company name
  - `code` (text, unique) - Short company code for identification
  - `contact_email` (text) - Primary contact email
  - `contact_phone` (text) - Primary contact phone
  - `address` (text) - Company headquarters address
  - `billing_address` (text) - Billing address
  - `tax_id` (text) - Tax identification number
  - `payment_terms` (text) - Payment terms (e.g., "NET30", "NET60")
  - `requires_approval` (boolean) - Whether delivery requests require admin approval
  - `credit_limit` (decimal) - Maximum outstanding balance allowed
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `company_staff`
  Links users to companies with specific roles
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `user_id` (uuid, foreign key to auth.users)
  - `role` (text) - Role: 'admin', 'staff', 'finance'
  - `employee_id` (text) - Optional employee identifier
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `departments`
  Organizational units within companies for cost tracking
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `name` (text) - Department name
  - `code` (text) - Department code
  - `cost_center` (text) - Cost center code for accounting
  - `budget` (decimal) - Monthly budget
  - `manager_user_id` (uuid, foreign key to auth.users)
  - `is_active` (boolean)
  - `created_at` (timestamptz)

  ### `corporate_orders`
  Extended order information for corporate clients
  - `id` (uuid, primary key)
  - `order_id` (uuid, foreign key to orders)
  - `company_id` (uuid, foreign key to companies)
  - `department_id` (uuid, foreign key to departments)
  - `requested_by` (uuid, foreign key to auth.users)
  - `approved_by` (uuid, foreign key to auth.users)
  - `approval_status` (text) - 'pending', 'approved', 'rejected'
  - `approval_notes` (text)
  - `po_number` (text) - Purchase order number
  - `internal_reference` (text) - Internal reference number
  - `approved_at` (timestamptz)
  - `created_at` (timestamptz)

  ### `bulk_deliveries`
  Grouping multiple deliveries into one bulk request
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `name` (text) - Bulk delivery name
  - `description` (text)
  - `requested_by` (uuid, foreign key to auth.users)
  - `total_deliveries` (integer)
  - `completed_deliveries` (integer, default 0)
  - `status` (text) - 'pending', 'in_progress', 'completed'
  - `created_at` (timestamptz)
  - `completed_at` (timestamptz)

  ### `bulk_delivery_items`
  Individual deliveries within a bulk request
  - `id` (uuid, primary key)
  - `bulk_delivery_id` (uuid, foreign key to bulk_deliveries)
  - `order_id` (uuid, foreign key to orders)
  - `sequence_number` (integer)
  - `created_at` (timestamptz)

  ### `scheduled_deliveries`
  Recurring delivery schedules
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `department_id` (uuid, foreign key to departments)
  - `name` (text) - Schedule name
  - `pickup_address` (text)
  - `dropoff_address` (text)
  - `package_description` (text)
  - `recurrence_type` (text) - 'daily', 'weekly', 'monthly'
  - `recurrence_day` (integer) - Day of week (1-7) or month (1-31)
  - `recurrence_time` (time) - Scheduled time
  - `is_active` (boolean)
  - `next_execution` (timestamptz)
  - `last_execution` (timestamptz)
  - `created_by` (uuid, foreign key to auth.users)
  - `created_at` (timestamptz)

  ### `company_invoices`
  Monthly invoices for corporate clients
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key to companies)
  - `invoice_number` (text, unique)
  - `period_start` (date)
  - `period_end` (date)
  - `subtotal` (decimal)
  - `tax_amount` (decimal)
  - `total_amount` (decimal)
  - `status` (text) - 'draft', 'issued', 'paid', 'overdue'
  - `issued_at` (timestamptz)
  - `due_date` (date)
  - `paid_at` (timestamptz)
  - `created_at` (timestamptz)

  ### `invoice_line_items`
  Individual charges on invoices
  - `id` (uuid, primary key)
  - `invoice_id` (uuid, foreign key to company_invoices)
  - `order_id` (uuid, foreign key to orders)
  - `description` (text)
  - `quantity` (integer)
  - `unit_price` (decimal)
  - `amount` (decimal)
  - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all new tables
  - Corporate admins can manage their company data
  - Staff can create requests and view their own data
  - Finance role has read-only access to invoices and reports
  - System admins have full access

  ## 3. Indexes
  - Index foreign keys for performance
  - Index status fields for filtering
  - Index dates for reporting queries
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  address text,
  billing_address text,
  tax_id text,
  payment_terms text DEFAULT 'NET30',
  requires_approval boolean DEFAULT true,
  credit_limit decimal(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company_staff table
CREATE TABLE IF NOT EXISTS company_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'staff', 'finance')),
  employee_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  cost_center text,
  budget decimal(10,2) DEFAULT 0,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Create corporate_orders table
CREATE TABLE IF NOT EXISTS corporate_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approval_notes text,
  po_number text,
  internal_reference text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_id)
);

-- Create bulk_deliveries table
CREATE TABLE IF NOT EXISTS bulk_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_deliveries integer DEFAULT 0,
  completed_deliveries integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create bulk_delivery_items table
CREATE TABLE IF NOT EXISTS bulk_delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_delivery_id uuid NOT NULL REFERENCES bulk_deliveries(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bulk_delivery_id, order_id)
);

-- Create scheduled_deliveries table
CREATE TABLE IF NOT EXISTS scheduled_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  package_description text,
  recurrence_type text NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly')),
  recurrence_day integer,
  recurrence_time time NOT NULL,
  is_active boolean DEFAULT true,
  next_execution timestamptz,
  last_execution timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create company_invoices table
CREATE TABLE IF NOT EXISTS company_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  subtotal decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  total_amount decimal(10,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
  issued_at timestamptz,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES company_invoices(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  amount decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_staff_company_id ON company_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_company_staff_user_id ON company_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_corporate_orders_order_id ON corporate_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_corporate_orders_company_id ON corporate_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_corporate_orders_department_id ON corporate_orders(department_id);
CREATE INDEX IF NOT EXISTS idx_corporate_orders_status ON corporate_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_bulk_deliveries_company_id ON bulk_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_bulk_delivery_items_bulk_id ON bulk_delivery_items(bulk_delivery_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_company_id ON scheduled_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invoices_company_id ON company_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invoices_status ON company_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is system admin
CREATE OR REPLACE FUNCTION is_system_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's company staff record
CREATE OR REPLACE FUNCTION get_user_company_staff(user_id uuid, company_id uuid)
RETURNS TABLE(id uuid, role text, is_active boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT cs.id, cs.role, cs.is_active
  FROM company_staff cs
  WHERE cs.user_id = user_id AND cs.company_id = company_id AND cs.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is company admin
CREATE OR REPLACE FUNCTION is_company_admin(user_id uuid, company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_staff
    WHERE company_staff.user_id = user_id 
    AND company_staff.company_id = company_id 
    AND company_staff.role = 'admin'
    AND company_staff.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user belongs to company
CREATE OR REPLACE FUNCTION is_company_member(user_id uuid, company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_staff
    WHERE company_staff.user_id = user_id 
    AND company_staff.company_id = company_id 
    AND company_staff.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for companies
CREATE POLICY "System admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company members can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_staff
      WHERE company_staff.company_id = companies.id
      AND company_staff.user_id = auth.uid()
      AND company_staff.is_active = true
    )
  );

CREATE POLICY "System admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "System admins can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- RLS Policies for company_staff
CREATE POLICY "System admins can view all company staff"
  ON company_staff FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can view their company staff"
  ON company_staff FOR SELECT
  TO authenticated
  USING (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Company members can view themselves"
  ON company_staff FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System admins can insert company staff"
  ON company_staff FOR INSERT
  TO authenticated
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can insert staff"
  ON company_staff FOR INSERT
  TO authenticated
  WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "System admins can update company staff"
  ON company_staff FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can update their staff"
  ON company_staff FOR UPDATE
  TO authenticated
  USING (is_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_admin(auth.uid(), company_id));

-- RLS Policies for departments
CREATE POLICY "System admins can view all departments"
  ON departments FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company members can view their company departments"
  ON departments FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "System admins can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "System admins can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can update their departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (is_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_admin(auth.uid(), company_id));

-- RLS Policies for corporate_orders
CREATE POLICY "System admins can view all corporate orders"
  ON corporate_orders FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company members can view their company orders"
  ON corporate_orders FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company staff can insert corporate orders"
  ON corporate_orders FOR INSERT
  TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "System admins can update corporate orders"
  ON corporate_orders FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can update their orders"
  ON corporate_orders FOR UPDATE
  TO authenticated
  USING (is_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_admin(auth.uid(), company_id));

CREATE POLICY "Requesters can update their pending orders"
  ON corporate_orders FOR UPDATE
  TO authenticated
  USING (requested_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (requested_by = auth.uid() AND approval_status = 'pending');

-- RLS Policies for bulk_deliveries
CREATE POLICY "System admins can view all bulk deliveries"
  ON bulk_deliveries FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company members can view their bulk deliveries"
  ON bulk_deliveries FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company staff can insert bulk deliveries"
  ON bulk_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "System admins can update bulk deliveries"
  ON bulk_deliveries FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can update their bulk deliveries"
  ON bulk_deliveries FOR UPDATE
  TO authenticated
  USING (is_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_admin(auth.uid(), company_id));

-- RLS Policies for bulk_delivery_items
CREATE POLICY "Users can view bulk delivery items if they can view the bulk delivery"
  ON bulk_delivery_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bulk_deliveries bd
      WHERE bd.id = bulk_delivery_items.bulk_delivery_id
      AND (
        is_system_admin(auth.uid()) OR
        is_company_member(auth.uid(), bd.company_id)
      )
    )
  );

CREATE POLICY "Users can insert bulk delivery items if they can manage the bulk delivery"
  ON bulk_delivery_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bulk_deliveries bd
      WHERE bd.id = bulk_delivery_items.bulk_delivery_id
      AND (
        is_system_admin(auth.uid()) OR
        is_company_member(auth.uid(), bd.company_id)
      )
    )
  );

-- RLS Policies for scheduled_deliveries
CREATE POLICY "System admins can view all scheduled deliveries"
  ON scheduled_deliveries FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company members can view their scheduled deliveries"
  ON scheduled_deliveries FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Company staff can insert scheduled deliveries"
  ON scheduled_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "System admins can update scheduled deliveries"
  ON scheduled_deliveries FOR UPDATE
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

CREATE POLICY "Company admins can update their scheduled deliveries"
  ON scheduled_deliveries FOR UPDATE
  TO authenticated
  USING (is_company_admin(auth.uid(), company_id))
  WITH CHECK (is_company_admin(auth.uid(), company_id));

-- RLS Policies for company_invoices
CREATE POLICY "System admins can view all invoices"
  ON company_invoices FOR SELECT
  TO authenticated
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Company members can view their invoices"
  ON company_invoices FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "System admins can manage invoices"
  ON company_invoices FOR ALL
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- RLS Policies for invoice_line_items
CREATE POLICY "Users can view line items if they can view the invoice"
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_invoices ci
      WHERE ci.id = invoice_line_items.invoice_id
      AND (
        is_system_admin(auth.uid()) OR
        is_company_member(auth.uid(), ci.company_id)
      )
    )
  );

CREATE POLICY "System admins can manage invoice line items"
  ON invoice_line_items FOR ALL
  TO authenticated
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Update trigger for companies
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_staff_updated_at
  BEFORE UPDATE ON company_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();