-- =====================================================
-- Step 1: PostgreSQL mein yeh command run karo:
--   CREATE DATABASE pizza_amore;
--   \c pizza_amore
--   \i schema.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  order_id         VARCHAR(20) UNIQUE NOT NULL,
  customer_name    VARCHAR(100) NOT NULL,
  customer_phone   VARCHAR(20) NOT NULL,
  delivery_address TEXT NOT NULL,
  landmark         VARCHAR(200),
  instructions     TEXT,
  latitude         DECIMAL(10,8),
  longitude        DECIMAL(11,8),
  payment_method   VARCHAR(10) NOT NULL CHECK (payment_method IN ('cod','online')),
  transaction_id   VARCHAR(100),
  items            JSONB NOT NULL,
  subtotal         INTEGER NOT NULL,
  delivery_charge  INTEGER NOT NULL DEFAULT 30,
  total_amount     INTEGER NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','preparing','out_for_delivery','delivered','cancelled')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION trg_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_updated_at();

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_orders_date   ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_phone  ON orders (customer_phone);

-- Daily summary view (admin ke liye useful)
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  DATE(created_at)                                    AS order_date,
  COUNT(*)                                            AS total_orders,
  COALESCE(SUM(total_amount),0)                       AS total_revenue,
  COUNT(*) FILTER (WHERE payment_method='cod')        AS cod_orders,
  COUNT(*) FILTER (WHERE payment_method='online')     AS online_orders,
  COUNT(*) FILTER (WHERE status='delivered')          AS delivered,
  COUNT(*) FILTER (WHERE status='cancelled')          AS cancelled
FROM orders
GROUP BY DATE(created_at)
ORDER BY order_date DESC;
