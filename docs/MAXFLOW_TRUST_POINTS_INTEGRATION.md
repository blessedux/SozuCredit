# MaxFlow Trust Points Integration

## Overview

This document explains how MaxFlow ego scores integrate with the trust points system to enable vouching, credit applications, and notifications.

## System Architecture

### 1. MaxFlow API Integration

**Purpose**: MaxFlow provides ego scores based on network flow analysis of Ethereum addresses. These scores determine initial trust point allocation and vouching eligibility.

**How it works**:

- Users link their Ethereum address (EVM address) to their profile
- MaxFlow API analyzes the address's network relationships
- Returns an ego score with metrics:
  - `localHealth`: Primary health metric (0-1 scale)
  - `metrics.totalNodes`: Total nodes in network
  - `metrics.acceptedUsers`: Users accepted in network
  - `metrics.avgResidualFlow`: Average residual flow
  - `metrics.medianMinCut`: Median minimum cut

**Trust Score Calculation**:

```typescript
trustScore =
  localHealth * 0.4 +
  avgResidualFlow * 0.3 +
  medianMinCut * 0.2 +
  (acceptedUsers / totalNodes) * 0.1;
```

### 2. Trust Points System

**Database Schema**:

```sql
trust_points (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id),
  balance integer DEFAULT 5,
  last_daily_credit timestamp,
  created_at timestamp,
  updated_at timestamp
)
```

**Initial Allocation**:

- **New users**: Start with 5 trust points (default)
- **Users with MaxFlow ego score**: Can receive additional initial points based on trust score
  - Trust score 0-0.5: 5 points (default)
  - Trust score 0.5-1.0: 7 points
  - Trust score 1.0-1.5: 10 points
  - Trust score 1.5+: 15 points

**Daily Credits**:

- Users receive 5 trust points daily (if they claim)
- Triggered by cron job or manual claim

### 3. Vouching System

**Requirements**:

1. **Sender must have trust points**: Cannot vouch if balance is 0
2. **Points are transferable**: When you vouch, points transfer from your account to theirs
3. **Track vouches**: Record who vouched for whom
4. **Notifications**: Notify recipient when someone vouches for them

**Database Schema**:

```sql
user_vouches (
  id uuid PRIMARY KEY,
  voucher_id uuid REFERENCES auth.users(id), -- Who gave the vouch
  vouched_user_id uuid REFERENCES auth.users(id), -- Who received the vouch
  trust_points_transferred integer NOT NULL,
  message text,
  created_at timestamp
)
```

**Vouching Flow**:

1. User enters username to vouch for
2. System checks:
   - Sender has enough trust points (balance >= points to transfer)
   - Sender has at least 1 trust point (cannot vouch with 0)
   - Target user exists
3. Transfer points:
   - Deduct from sender's balance
   - Add to receiver's balance
4. Record vouch:
   - Create entry in `user_vouches` table
5. Create notification:
   - Notify receiver that they received a vouch

### 4. Credit Application Eligibility

**Requirement**: Users need 5+ trust points to apply for business credit/loan

**API Endpoint**: `GET /api/wallet/credit-eligibility`

- Returns: `{ eligible: boolean, trustPoints: number, reason?: string }`

### 5. Notifications System

**Database Schema** (already exists):

```sql
notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  type text, -- 'vouch_received', 'daily_credit_available', etc.
  title text,
  message text,
  read boolean DEFAULT false,
  created_at timestamp
)
```

**Notification Types**:

- `vouch_received`: Someone vouched for you
- `daily_credit_available`: Daily trust points are available
- `credit_eligible`: You now have 5+ trust points and can apply for credit

## Implementation Plan

### Phase 1: Database Schema Updates

1. **Create `user_vouches` table**:

   - Track who vouched for whom
   - Store points transferred
   - Optional message

2. **Update `trust_points` table** (if needed):

   - Add `initial_allocation_source` field (optional, for tracking MaxFlow vs default)

3. **Ensure `notifications` table exists**:
   - Already created in `009_add_notifications.sql`

### Phase 2: Backend API Updates

1. **Update `/api/wallet/vouch` endpoint**:

   - Enforce minimum 1 trust point requirement
   - Record vouch in `user_vouches` table
   - Create notification for receiver
   - Return vouch details

2. **Create `/api/wallet/credit-eligibility` endpoint**:

   - Check if user has 5+ trust points
   - Return eligibility status

3. **Create `/api/wallet/trust-points/initialize` endpoint** (optional):

   - Initialize trust points based on MaxFlow ego score
   - Only run once per user
   - Can be called when user links EVM address

4. **Update `/api/wallet/trust-points` endpoint**:
   - Include vouches received count
   - Include vouches given count

### Phase 3: MaxFlow Integration

1. **Update vouching eligibility check**:

   - Optionally check MaxFlow ego score before allowing vouch
   - Can be used as additional validation (not required)

2. **Trust points initialization**:
   - When user links EVM address, check MaxFlow ego score
   - If trust score is high enough, grant additional initial points
   - Only if user hasn't received initial allocation yet

## API Endpoints

### POST /api/wallet/vouch

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
  "message": "Trust points transferred successfully",
  "vouch": {
    "id": "vouch_id",
    "voucher_id": "sender_user_id",
    "vouched_user_id": "receiver_user_id",
    "trust_points_transferred": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errors**:

- `400`: Insufficient trust points, invalid username, cannot vouch with 0 points
- `404`: Target user not found
- `500`: Internal server error

### GET /api/wallet/credit-eligibility

**Response**:

```json
{
  "eligible": true,
  "trustPoints": 5,
  "reason": null
}
```

**Errors**:

- `401`: Unauthorized
- `500`: Internal server error

### GET /api/wallet/vouches/received

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

## Database Migrations

See `scripts/010_add_user_vouches.sql` for the migration script.

## Testing

1. **Vouching with 0 points**: Should fail
2. **Vouching with 1 point**: Should succeed, transfer 1 point
3. **Vouching with 5 points**: Should succeed, transfer up to 5 points
4. **Notification creation**: Should create notification when vouch is received
5. **Credit eligibility**: Should return eligible when balance >= 5
6. **MaxFlow integration**: Should initialize additional points for high trust scores
