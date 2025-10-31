# Database Setup Instructions

This guide explains how to set up your Supabase database tables for the SozuCredit application.

## Prerequisites

1. A Supabase project (https://supabase.com)
2. Access to your Supabase project's SQL Editor

## Step-by-Step Setup

### 1. Access Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query** to create a new SQL query

### 2. Run SQL Scripts in Order

Run the following SQL scripts **in order** (they depend on each other):

#### Step 1: Create Base Schema

```sql
-- Run: scripts/001_create_schema.sql
```

This creates:

- `profiles` table
- `business_ideas` table
- `vouches` table
- `trust_points` table
- `vaults` table
- `transactions` table
- `course_progress` table
- Row Level Security policies

#### Step 2: Create Triggers

```sql
-- Run: scripts/002_create_triggers.sql
```

This creates:

- Auto-create profile, trust points, and vault on user signup
- Daily trust points function (for cron job)

#### Step 3: Daily Trust Points Cron (Optional)

```sql
-- Run: scripts/003_daily_trust_points_cron.sql
```

This sets up a cron job to automatically add daily trust points.

**Note:** You need to enable the `pg_cron` extension first:

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### Step 4: Add Passkeys Table

```sql
-- Run: scripts/004_add_passkeys.sql
```

This creates:

- `passkeys` table for WebAuthn credentials
- Updates `profiles` table to add username column
- Row Level Security policies for passkeys

## Verification

After running all scripts, verify the tables exist:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:

- `business_ideas`
- `course_progress`
- `passkeys`
- `profiles`
- `transactions`
- `trust_points`
- `vaults`
- `vouches`

## Troubleshooting

### Error: "relation already exists"

If you get this error, the table already exists. You can either:

1. Drop the existing table and recreate it (⚠️ **WARNING:** This deletes all data)
2. Skip that script if you've already run it

### Error: "column already exists"

If you get this error when running `004_add_passkeys.sql`, the column already exists. This is fine - the script uses `IF NOT EXISTS` clauses to handle this safely.

### Error: "permission denied"

Make sure you're running the scripts as a database admin or have the necessary permissions.

## Important Notes

1. **Run scripts in order**: Scripts depend on each other, so run them sequentially
2. **Backup first**: Always backup your database before running migration scripts
3. **Test environment**: Test these scripts on a development/staging database first
4. **RLS Policies**: Row Level Security is enabled by default. Make sure your policies match your application's access requirements

## Quick Setup Command

You can also copy-paste all scripts into a single SQL editor window and run them together. Make sure they're in this order:

1. `001_create_schema.sql`
2. `002_create_triggers.sql`
3. `003_daily_trust_points_cron.sql` (optional)
4. `004_add_passkeys.sql`
