-- Simple Balance Tracking Queries
-- These queries work without needing to know your user_id

-- ============================================
-- VIEW ALL WALLETS (EASIEST - NO USER_ID NEEDED)
-- ============================================
SELECT 
  sw.user_id,
  u.email,
  p.username,
  sw.public_key,
  sw.previous_usdc_balance,
  sw.updated_at
FROM stellar_wallets sw
LEFT JOIN auth.users u ON sw.user_id = u.id
LEFT JOIN profiles p ON sw.user_id = p.id
ORDER BY sw.updated_at DESC;

-- ============================================
-- VIEW ALL BALANCE SNAPSHOTS (EASIEST - NO USER_ID NEEDED)
-- ============================================
SELECT 
  bs.user_id,
  u.email,
  p.username,
  bs.usdc_balance,
  bs.previous_balance,
  bs.balance_change,
  bs.auto_deposit_triggered,
  bs.snapshot_type,
  bs.created_at
FROM balance_snapshots bs
LEFT JOIN auth.users u ON bs.user_id = u.id
LEFT JOIN profiles p ON bs.user_id = p.id
ORDER BY bs.created_at DESC
LIMIT 20;

-- ============================================
-- CHECK DATABASE SCHEMA (VERIFY MIGRATION WORKED)
-- ============================================
-- Check if previous_usdc_balance column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stellar_wallets'
AND column_name = 'previous_usdc_balance';

-- Check if balance_snapshots table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'balance_snapshots';

