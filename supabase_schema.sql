-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT UNIQUE NOT NULL, -- The slug (e.g., 'shalibhadra')
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial tenants
INSERT INTO tenants (tenant_id, name) VALUES ('shalibhadra', 'Shalibhadra Courier') ON CONFLICT (tenant_id) DO NOTHING;
INSERT INTO tenants (tenant_id, name) VALUES ('navkar', 'Navkar Courier') ON CONFLICT (tenant_id) DO NOTHING;

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tracking_url_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop existing tables to recreate with new references
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table (updated)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipments table (updated)
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  sender_adhaar TEXT,
  sender_contact TEXT,
  sender_email TEXT,
  receiver_name TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_contact TEXT,
  receiver_email TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  shipment_date TIMESTAMP WITH TIME ZONE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  port_of_loading TEXT,
  service_id UUID REFERENCES services(id),
  service_details TEXT,
  awb_no TEXT,
  box_count INTEGER NOT NULL,
  packages JSONB NOT NULL,
  pcs INTEGER,
  weight TEXT,
  volumetric_weight TEXT,
  currency TEXT,
  total_amount NUMERIC,
  amount_in_words TEXT,
  billing_amount NUMERIC,
  payment_type TEXT DEFAULT 'Cash' NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Insert initial services for shalibhadra
DO $$
DECLARE
    shalibhadra_id UUID;
BEGIN
    SELECT id INTO shalibhadra_id FROM tenants WHERE tenant_id = 'shalibhadra';
    
    IF shalibhadra_id IS NOT NULL THEN
        INSERT INTO services (name, tenant_id, tracking_url_template) VALUES 
        ('FedEx', shalibhadra_id, 'https://www.fedex.com/fedextrack/?trknbr={{id}}'),
        ('DHL', shalibhadra_id, 'https://www.dhl.com/in-en/home/tracking.html?tracking-id={{id}}&submit=1'),
        ('UPS', shalibhadra_id, NULL),
        ('Mahavir', shalibhadra_id, NULL),
        ('Bluedart', shalibhadra_id, NULL),
        ('DTDC', shalibhadra_id, NULL),
        ('Nandan', shalibhadra_id, NULL),
        ('Delivery', shalibhadra_id, NULL),
        ('Self', shalibhadra_id, NULL)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Insert initial services for navkar
DO $$
DECLARE
    navkar_id UUID;
BEGIN
    SELECT id INTO navkar_id FROM tenants WHERE tenant_id = 'navkar';
    
    IF navkar_id IS NOT NULL THEN
        INSERT INTO services (name, tenant_id, tracking_url_template) VALUES 
        ('FedEx', navkar_id, 'https://www.fedex.com/fedextrack/?trknbr={{id}}'),
        ('DHL', navkar_id, 'https://www.dhl.com/in-en/home/tracking.html?tracking-id={{id}}&submit=1'),
        ('UPS', navkar_id, NULL),
        ('Mahavir', navkar_id, NULL),
        ('Bluedart', navkar_id, NULL),
        ('DTDC', navkar_id, NULL),
        ('Nandan', navkar_id, NULL),
        ('Delivery', navkar_id, NULL),
        ('Self', navkar_id, NULL)
        ON CONFLICT DO NOTHING;

    END IF;
END $$;