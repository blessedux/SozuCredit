# Trustworthy Vouches System

## Overview

This document describes the trustworthy vouches system that determines credit eligibility based on TRUST points received from trustworthy users (not from referrals).

## Key Requirements

1. **Referral-based TRUST points**: Users get TRUST points for inviting other users (existing feature, working)

2. **Credit eligibility requirements**:

   - Need 5 TRUST points that were **received** from other users (not from inviting)
   - These must be from "trustworthy" users
   - A reviewer must check if the profiles that sent the trust points are reputable enough

3. **Trustworthiness rules** (MVP):

   - A new wallet with no balance is NOT trustworthy
   - If they haven't accessed and paid back any credit, they are NOT trustworthy (if they've taken credit)
   - If they are less than a month old, they are NOT trustworthy

4. **Review process**: Reviewers can review and override auto-checks if needed

## Database Schema

### Updated `user_vouches` Table

New columns added:

- `is_trustworthy` (boolean, nullable): Whether the voucher (person who gave the vouch) is trustworthy
  - `null` = not yet checked
  - `true` = trustworthy (auto-check passed or manually approved)
  - `false` = not trustworthy (auto-check failed or manually rejected)
- `reviewed_by` (uuid, nullable): User ID of the reviewer who manually reviewed this vouch
- `reviewed_at` (timestamp, nullable): Timestamp when this vouch was manually reviewed
- `review_notes` (text, nullable): Notes from the reviewer

### Database Functions

1. **`is_user_trustworthy(user_uuid uuid)`**: Checks if a user is trustworthy based on:

   - Account age (must be at least 1 month old)
   - Wallet balance (must have balance > 0)
   - Credit repayment history (if they've taken credit, must have at least one paid loan)

2. **`get_trustworthy_vouches_count(user_uuid uuid)`**: Returns the total count of trustworthy TRUST points received by a user

3. **`can_apply_for_credit(user_uuid uuid)`**: Checks if a user is eligible for credit (has 5+ trustworthy vouches)

### Database Triggers

- **`check_vouch_trustworthiness_trigger`**: Automatically checks trustworthiness when a vouch is created
  - Runs BEFORE INSERT on `user_vouches`
  - Calls `is_user_trustworthy()` to check the voucher
  - Sets `is_trustworthy` based on the auto-check result

## API Endpoints

### 1. GET /api/wallet/credit-eligibility (Updated)

**Purpose**: Check if user is eligible to apply for business credit/loan

**Requirements**:

- User must have 5+ TRUST points received from trustworthy users (not from referrals)

**Response**:

```json
{
  "eligible": true,
  "trustworthyVouchesCount": 5,
  "totalTrustPoints": 10,
  "breakdown": {
    "trustworthy": 5,
    "pending": 2,
    "untrustworthy": 3,
    "total": 10
  },
  "reason": null
}
```

### 2. GET /api/wallet/vouches/pending-review

**Purpose**: Get all vouches pending review

**Returns**: Vouches that need manual review:

- `is_trustworthy` is `null` (not yet checked)
- `is_trustworthy` is `false` (auto-check failed)
- `is_trustworthy` is `true` but `reviewed_by` is `null` (auto-check passed but not manually reviewed)

**Response**:

```json
{
  "vouches": [
    {
      "id": "vouch_id",
      "voucher_id": "user_id",
      "vouched_user_id": "user_id",
      "trust_points_transferred": 1,
      "is_trustworthy": false,
      "auto_trustworthy_check": false,
      "voucher": {
        "id": "user_id",
        "username": "voucher_username",
        "display_name": "Voucher Name",
        "email": "voucher@example.com",
        "created_at": "2024-01-01T00:00:00Z"
      },
      "vouched_user": {
        "id": "user_id",
        "username": "vouched_username",
        "display_name": "Vouched User Name",
        "email": "vouched@example.com"
      }
    }
  ],
  "count": 10
}
```

### 3. POST /api/wallet/vouches/review

**Purpose**: Review a vouch and mark it as trustworthy or not

**Request**:

```json
{
  "vouchId": "vouch_id",
  "isTrustworthy": true,
  "reviewNotes": "Optional notes from reviewer"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Vouch reviewed successfully",
  "vouch": {
    "id": "vouch_id",
    "is_trustworthy": true,
    "reviewed_by": "reviewer_user_id",
    "reviewed_at": "2024-01-01T00:00:00Z",
    "review_notes": "Optional notes"
  },
  "vouchedUserEligible": true,
  "trustworthyVouchesCount": 5
}
```

### 4. POST /api/wallet/vouch (Updated)

**Purpose**: Transfer trust points from one user to another (vouching)

**Response now includes**:

```json
{
  "success": true,
  "message": "Puntos de confianza enviados",
  "vouch": {
    "id": "vouch_id",
    "voucher_id": "sender_user_id",
    "vouched_user_id": "receiver_user_id",
    "trust_points_transferred": 1,
    "is_trustworthy": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Trustworthiness Rules (MVP)

### Rule 1: Account Age

- User must be at least 1 month old
- Checked via `auth.users.created_at`

### Rule 2: Wallet Balance

- User must have balance in wallet (not empty)
- Checked via `stellar_wallets` and `balance_snapshots`
- Must have at least one balance snapshot with `usdc_balance > 0`

### Rule 3: Credit Repayment History

- If user has taken credit (has loans), they must have at least one paid loan
- Checked via `loans` table (if it exists)
- If user hasn't taken credit, they're still trustworthy (default: `has_paid_back_credit = true`)

## Workflow

1. **User receives a vouch**:

   - Vouch is created in `user_vouches` table
   - Trigger automatically checks if voucher is trustworthy
   - `is_trustworthy` is set based on auto-check result

2. **Reviewer reviews vouches**:

   - Reviewer calls `/api/wallet/vouches/pending-review` to see vouches needing review
   - Reviewer calls `/api/wallet/vouches/review` to mark vouches as trustworthy or not
   - Reviewer can override auto-check results if needed

3. **Credit eligibility check**:
   - User calls `/api/wallet/credit-eligibility`
   - System checks if user has 5+ trustworthy vouches
   - Only vouches where `is_trustworthy = true` count toward eligibility

## Migration

Run the migration script:

```bash
psql -d your_database -f scripts/015_add_trustworthy_vouches.sql
```

This migration:

- Adds `is_trustworthy`, `reviewed_by`, `reviewed_at`, and `review_notes` columns to `user_vouches`
- Creates `is_user_trustworthy()` function
- Creates `get_trustworthy_vouches_count()` function
- Updates `can_apply_for_credit()` function
- Creates `check_vouch_trustworthiness()` trigger function
- Creates trigger to auto-check trustworthiness on vouch creation

## Notes

- **Referral points don't count**: Only vouches (TRUST points received from other users) count toward credit eligibility
- **Auto-check vs Manual Review**: Auto-check runs first, but reviewers can override if needed
- **MVP Rules**: The trustworthiness rules are the basis for future implementation - they can be expanded later
- **Reviewer Role**: Currently, any authenticated user can review vouches. In production, you should add a reviewer role check
