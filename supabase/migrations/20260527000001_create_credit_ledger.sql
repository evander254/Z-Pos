ALTER TABLE customers ADD COLUMN credit_balance NUMERIC DEFAULT 0;

CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  customer_id UUID REFERENCES customers(id),
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
