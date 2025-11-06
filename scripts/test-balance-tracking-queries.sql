-- Balance Tracking Test Queries
-- These queries help you test the balance tracking functionality
-- IMPORTANT: Replace placeholders with actual values

-- ============================================
-- STEP 1: Get Your User ID
-- ============================================

-- Option 1: Find your user_id by email (replace with your email)
SELECT id as user_id, email 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Option 2: List all users (to find yours)
SELECT id as user_id, email, created_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- Option 3: Get from profiles table (using username)
SELECT id as user_id, username, display_name
FROM profiles 
WHERE username = 'your-username';

-- ============================================
-- STEP 2: Check Database Schema
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

-- ============================================
-- STEP 3: View All Wallets (Easiest Way)
-- ============================================

-- View all wallets with user email (no need to know user_id)
-- Note: email is in auth.users, not profiles
SELECT 
  sw.id,
  sw.user_id,
  u.email,
  p.username,
  p.display_name,
  sw.public_key,
  sw.previous_usdc_balance,
  sw.updated_at,
  sw.created_at
FROM stellar_wallets sw
LEFT JOIN auth.users u ON sw.user_id = u.id
LEFT JOIN profiles p ON sw.user_id = p.id
ORDER BY sw.updated_at DESC;

-- ============================================
-- STEP 4: View All Balance Snapshots (Easiest Way)
-- ============================================

-- View all recent balance snapshots with user email
-- Note: email is in auth.users, not profiles
SELECT 
  bs.id,
  bs.user_id,
  u.email,
  p.username,
  p.display_name,
  bs.usdc_balance,
  bs.previous_balance,
  bs.balance_change,
  bs.auto_deposit_triggered,
  bs.deposit_amount,
  bs.transaction_hash,
  bs.snapshot_type,
  bs.created_at
FROM balance_snapshots bs
LEFT JOIN auth.users u ON bs.user_id = u.id
LEFT JOIN profiles p ON bs.user_id = p.id
ORDER BY bs.created_at DESC
LIMIT 20;

-- ============================================
-- STEP 5: Check Specific User (After Getting User ID)
-- ============================================

-- Replace '<YOUR_USER_ID>' with actual UUID from Step 1
-- Example: WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'

-- Get wallet for specific user
SELECT 
  id,
  user_id,
  public_key,
  previous_usdc_balance,
  updated_at
FROM stellar_wallets
WHERE user_id = '<YOUR_USER_ID>';  -- Replace with actual UUID

-- Get balance snapshots for specific user
SELECT 
  id,
  user_id,
  usdc_balance,
  previous_balance,
  balance_change,
  auto_deposit_triggered,
  deposit_amount,
  transaction_hash,
  snapshot_type,
  created_at
FROM balance_snapshots
WHERE user_id = '<YOUR_USER_ID>'  -- Replace with actual UUID
ORDER BY created_at DESC
LIMIT 10;

-- Get auto-deposit events for specific user
SELECT 
  created_at,
  usdc_balance,
  previous_balance,
  balance_change,
  deposit_amount,
  transaction_hash
FROM balance_snapshots
WHERE user_id = '<YOUR_USER_ID>'  -- Replace with actual UUID
AND auto_deposit_triggered = true
ORDER BY created_at DESC;

-- ============================================
-- STEP 6: Statistics
-- ============================================

-- Count of wallets with balance tracking
SELECT 
  COUNT(*) as total_wallets,
  COUNT(previous_usdc_balance) as wallets_with_previous_balance,
  COUNT(*) - COUNT(previous_usdc_balance) as wallets_without_previous_balance
FROM stellar_wallets;

-- Count of balance snapshots
SELECT 
  COUNT(*) as total_snapshots,
  COUNT(CASE WHEN auto_deposit_triggered = true THEN 1 END) as auto_deposit_events,
  COUNT(DISTINCT user_id) as unique_users
FROM balance_snapshots;

-- Recent balance snapshots summary
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as snapshot_count,
  COUNT(CASE WHEN auto_deposit_triggered = true THEN 1 END) as auto_deposit_count
FROM balance_snapshots
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

