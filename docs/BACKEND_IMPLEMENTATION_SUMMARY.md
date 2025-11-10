# Backend Implementation Summary

## Overview

This document summarizes the backend implementation for the MaxFlow trust points integration system. All backend APIs are complete and ready for testing.

## Database Schema

### New Tables Created

1. **`user_vouches`** - Tracks user-to-user vouches

   - `id`: UUID primary key
   - `voucher_id`: User who gave the vouch
   - `vouched_user_id`: User who received the vouch
   - `trust_points_transferred`: Points transferred
   - `message`: Optional message
   - `created_at`: Timestamp

2. **`notifications`** - System notifications
   - `id`: UUID primary key
   - `user_id`: User who receives the notification
   - `type`: Notification type ('vouch_received', 'daily_credit_available', 'credit_eligible')
   - `title`: Notification title
   - `message`: Notification message
   - `read`: Read status
   - `metadata`: Additional JSON data
   - `created_at`: Timestamp

### Database Migration

Run the migration script:

```bash
psql -d your_database -f scripts/010_add_user_vouches.sql
```

This migration:

- Creates `user_vouches` table
- Creates `notifications` table
- Adds `username` and `evm_address` columns to `profiles` if they don't exist
- Creates indexes for performance
- Sets up Row Level Security policies
- Creates trigger to automatically create notifications when vouches are received

## API Endpoints

### 1. POST /api/wallet/vouch

**Purpose**: Transfer trust points from one user to another (vouching)

**Request**:

```json
{
  "username": "target_username",
  "points": 1
}
```

**Response**:

```json
{
  "success": true,
  "message": "Puntos de confianza enviados",
  "vouch": {
    "id": "vouch_id",
    "voucher_id": "sender_user_id",
    "vouched_user_id": "receiver_user_id",
    "trust_points_transferred": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Validation**:

- ✅ Cannot vouch if balance is 0 (enforced)
- ✅ Cannot vouch if balance < points requested
- ✅ Cannot vouch for yourself (self-vouching prevented)
- ✅ Target user must exist

**What it does**:

1. Validates sender has enough trust points
2. Transfers points from sender to receiver
3. Records vouch in `user_vouches` table
4. Automatically creates notification for receiver (via database trigger)

### 2. GET /api/wallet/credit-eligibility

**Purpose**: Check if user is eligible to apply for business credit/loan

**Response**:

```json
{
  "eligible": true,
  "trustPoints": 5,
  "reason": null
}
```

**Requirements**:

- User must have 5+ trust points to be eligible

**Use case**: Check before allowing user to submit credit application

### 3. GET /api/wallet/vouches/received

**Purpose**: Get all vouches received by the authenticated user

**Response**:

```json
{
  "vouches": [
    {
      "id": "vouch_id",
      "voucher": {
        "id": "user_id",
        "username": "voucher_username",
        "display_name": "Voucher Name"
      },
      "trust_points_transferred": 1,
      "message": "Optional message",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10
}
```

**Use case**: Display list of who vouched for the user

### 4. POST /api/wallet/trust-points/initialize

**Purpose**: Initialize trust points based on MaxFlow ego score

**Response**:

```json
{
  "success": true,
  "message": "Trust points initialized based on MaxFlow ego score",
  "trustPoints": 10,
  "trustScore": 1.2,
  "initialAllocation": 10,
  "egoScore": {
    "localHealth": 0.8,
    "metrics": { ... }
  }
}
```

**Allocation Rules**:

- Trust score 0-0.5: 5 points (default)
- Trust score 0.5-1.0: 7 points
- Trust score 1.0-1.5: 10 points
- Trust score 1.5+: 15 points

**When to call**: When user links their EVM address for the first time

**Safety**: Only initializes once per user (checks if trust points already exist)

### 5. GET /api/wallet/trust-points (Updated)

**Purpose**: Get user's trust points with vouch statistics

**Response**:

```json
{
  "trustPoints": {
    "id": "trust_points_id",
    "user_id": "user_id",
    "balance": 5,
    "last_daily_credit": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "vouchesGiven": 3,
    "vouchesReceived": 5
  }
}
```

**New fields**:

- `vouchesGiven`: Count of vouches the user has given
- `vouchesReceived`: Count of vouches the user has received

## How It Works

### Trust Points Flow

1. **Initial Allocation**:

   - New users: 5 trust points (default)
   - Users with MaxFlow ego score: Can receive additional points (5-15 based on trust score)
   - Call `/api/wallet/trust-points/initialize` when user links EVM address

2. **Daily Credits**:

   - Users can claim 5 trust points daily
   - Existing daily credit system continues to work

3. **Vouching**:

   - User must have at least 1 trust point to vouch
   - Points transfer from sender to receiver
   - Vouch is recorded in `user_vouches` table
   - Notification is automatically created for receiver

4. **Credit Eligibility**:
   - User needs 5+ trust points to apply for business credit/loan
   - Check eligibility with `/api/wallet/credit-eligibility`

### MaxFlow Integration

1. **Ego Score Fetching**:

   - MaxFlow API analyzes Ethereum address network relationships
   - Returns ego score with metrics (localHealth, totalNodes, acceptedUsers, etc.)

2. **Trust Score Calculation**:

   ```typescript
   trustScore =
     localHealth * 0.4 +
     avgResidualFlow * 0.3 +
     medianMinCut * 0.2 +
     (acceptedUsers / totalNodes) * 0.1;
   ```

3. **Initial Points Allocation**:
   - Based on trust score, users receive 5-15 initial trust points
   - Only applies when user first links EVM address

### Notifications

Notifications are automatically created via database trigger when:

- User receives a vouch (type: `vouch_received`)
- Daily credit becomes available (type: `daily_credit_available`) - existing system
- User becomes eligible for credit (type: `credit_eligible`) - can be added later

## Testing Checklist

- [ ] Test vouching with 0 points (should fail)
- [ ] Test vouching with 1 point (should succeed)
- [ ] Test vouching with 5 points (should succeed)
- [ ] Test self-vouching (should fail)
- [ ] Test vouching for non-existent user (should fail)
- [ ] Test credit eligibility with < 5 points (should return eligible: false)
- [ ] Test credit eligibility with 5+ points (should return eligible: true)
- [ ] Test vouches received endpoint (should return list of vouches)
- [ ] Test trust points initialize with high trust score (should grant 15 points)
- [ ] Test trust points initialize with low trust score (should grant 5 points)
- [ ] Test notification creation when vouch is received
- [ ] Test trust points endpoint includes vouch statistics

## Next Steps

1. **Run Database Migration**:

   ```bash
   psql -d your_database -f scripts/010_add_user_vouches.sql
   ```

2. **Test All Endpoints**: Use Postman or curl to test each endpoint

3. **Frontend Integration**:

   - Add UI for vouching
   - Display vouches received
   - Show credit eligibility status
   - Display vouch statistics

4. **Notification UI**:
   - Create notification component
   - Display unread notifications
   - Mark notifications as read

## Files Created/Modified

### Created:

- `scripts/010_add_user_vouches.sql` - Database migration
- `app/api/wallet/credit-eligibility/route.ts` - Credit eligibility endpoint
- `app/api/wallet/vouches/received/route.ts` - Vouches received endpoint
- `app/api/wallet/trust-points/initialize/route.ts` - MaxFlow initialization endpoint
- `docs/MAXFLOW_TRUST_POINTS_INTEGRATION.md` - Integration documentation
- `docs/BACKEND_IMPLEMENTATION_SUMMARY.md` - This file

### Modified:

- `app/api/wallet/vouch/route.ts` - Added 0 points check, vouch recording, self-vouching prevention
- `app/api/wallet/trust-points/route.ts` - Added vouch statistics

## Environment Variables

No new environment variables required. Uses existing:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAXFLOW_API_URL` (optional, defaults to https://maxflow.one)
