-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date DATE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  box_count INTEGER NOT NULL,
  packages JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (Optional but recommended, for now we rely on backend logic)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Allow backend to read/write (if using service role, RLS is bypassed by default)
-- But for clarity, we can add policies if needed. For now, we skip complex RLS.
