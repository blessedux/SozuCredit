# API Testing Guide

## Prerequisites

1. **Server Running**: Make sure your Next.js dev server is running (`npm run dev` or `pnpm dev`)
2. **Database**: Ensure the migration script `010_add_user_vouches.sql` has been run successfully
3. **Test Users**: You'll need at least 2 user accounts to test vouching

## Testing Setup

### Get User IDs

First, you need to get user IDs from your database or from the sessionStorage in your browser:

```sql
-- Get user IDs from database
SELECT id, email FROM auth.users LIMIT 5;
```

Or check your browser's sessionStorage:

```javascript
// In browser console
sessionStorage.getItem("dev_username");
```

## API Endpoints to Test

### 1. GET /api/wallet/trust-points

**Purpose**: Get user's trust points with vouch statistics

**Test**:

```bash
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: YOUR_USER_ID"
```

**Expected Response**:

```json
{
  "trustPoints": {
    "id": "...",
    "user_id": "...",
    "balance": 5,
    "last_daily_credit": null,
    "created_at": "...",
    "updated_at": "...",
    "vouchesGiven": 0,
    "vouchesReceived": 0
  }
}
```

---

### 2. POST /api/wallet/vouch

**Purpose**: Transfer trust points from one user to another

**Test Cases**:

#### Test 1: Normal Vouch (Should Succeed)

```bash
curl -X POST http://localhost:3000/api/wallet/vouch \
  -H "Content-Type: application/json" \
  -H "x-user-id: SENDER_USER_ID" \
  -d '{
    "username": "target_username",
    "points": 1
  }'
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Puntos de confianza enviados",
  "vouch": {
    "id": "...",
    "voucher_id": "SENDER_USER_ID",
    "vouched_user_id": "RECEIVER_USER_ID",
    "trust_points_transferred": 1,
    "created_at": "..."
  }
}
```

#### Test 2: Vouch with 0 Points (Should Fail)

First, set a user's balance to 0:

```sql
UPDATE trust_points SET balance = 0 WHERE user_id = 'SENDER_USER_ID';
```

Then try to vouch:

```bash
curl -X POST http://localhost:3000/api/wallet/vouch \
  -H "Content-Type: application/json" \
  -H "x-user-id: SENDER_USER_ID" \
  -d '{
    "username": "target_username",
    "points": 1
  }'
```

**Expected Response**:

```json
{
  "error": "No puedes apoyar a otros usuarios sin puntos de confianza. Necesitas al menos 1 punto."
}
```

#### Test 3: Self-Vouching (Should Fail)

```bash
curl -X POST http://localhost:3000/api/wallet/vouch \
  -H "Content-Type: application/json" \
  -H "x-user-id: SAME_USER_ID" \
  -d '{
    "username": "same_user_username",
    "points": 1
  }'
```

**Expected Response**:

```json
{
  "error": "No puedes apoyarte a ti mismo"
}
```

#### Test 4: Insufficient Points (Should Fail)

```bash
curl -X POST http://localhost:3000/api/wallet/vouch \
  -H "Content-Type: application/json" \
  -H "x-user-id: SENDER_USER_ID" \
  -d '{
    "username": "target_username",
    "points": 100
  }'
```

**Expected Response**:

```json
{
  "error": "No tienes suficientes puntos de confianza"
}
```

---

### 3. GET /api/wallet/vouches/received

**Purpose**: Get all vouches received by the authenticated user

**Test**:

```bash
curl -X GET http://localhost:3000/api/wallet/vouches/received \
  -H "x-user-id: USER_ID"
```

**Expected Response**:

```json
{
  "vouches": [
    {
      "id": "...",
      "voucher": {
        "id": "...",
        "username": "voucher_username",
        "display_name": "Voucher Name"
      },
      "trust_points_transferred": 1,
      "message": null,
      "created_at": "..."
    }
  ],
  "total": 1
}
```

---

### 4. GET /api/wallet/credit-eligibility

**Purpose**: Check if user is eligible to apply for business credit/loan

#### Test 1: User with 5+ Points (Should be Eligible)

```bash
curl -X GET http://localhost:3000/api/wallet/credit-eligibility \
  -H "x-user-id: USER_ID"
```

**Expected Response** (if user has 5+ points):

```json
{
  "eligible": true,
  "trustPoints": 5,
  "reason": null
}
```

#### Test 2: User with < 5 Points (Should NOT be Eligible)

First, set user's balance to 3:

```sql
UPDATE trust_points SET balance = 3 WHERE user_id = 'USER_ID';
```

Then check eligibility:

```bash
curl -X GET http://localhost:3000/api/wallet/credit-eligibility \
  -H "x-user-id: USER_ID"
```

**Expected Response**:

```json
{
  "eligible": false,
  "trustPoints": 3,
  "reason": "Necesitas al menos 5 puntos de confianza para solicitar un crédito. Tienes 3 punto(s)."
}
```

---

### 5. POST /api/wallet/trust-points/initialize

**Purpose**: Initialize trust points based on MaxFlow ego score

**Prerequisites**:

- User must have an EVM address linked in their profile

**Test**:

```bash
curl -X POST http://localhost:3000/api/wallet/trust-points/initialize \
  -H "x-user-id: USER_ID"
```

**Expected Response**:

```json
{
  "success": true,
  "message": "Trust points initialized based on MaxFlow ego score",
  "trustPoints": 10,
  "trustScore": 1.2,
  "initialAllocation": 10,
  "egoScore": {
    "localHealth": 0.8,
    "metrics": {
      "totalNodes": 100,
      "acceptedUsers": 50,
      "avgResidualFlow": 0.5,
      "medianMinCut": 0.3,
      "maxPossibleFlow": 1.0
    }
  }
}
```

**Note**: If MaxFlow API is unavailable or user doesn't have EVM address, it will use default 5 points.

---

## Complete Test Flow

### Scenario: Two Users Vouching for Each Other

1. **Setup**: Create two test users (User A and User B)

2. **Check Initial Trust Points**:

```bash
# User A
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: USER_A_ID"

# User B
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: USER_B_ID"
```

3. **User A Vouches for User B**:

```bash
curl -X POST http://localhost:3000/api/wallet/vouch \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_A_ID" \
  -d '{
    "username": "user_b_username",
    "points": 1
  }'
```

4. **Verify Trust Points Updated**:

```bash
# User A should have 4 points (5 - 1)
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: USER_A_ID"

# User B should have 6 points (5 + 1)
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: USER_B_ID"
```

5. **Check Vouches Received**:

```bash
# User B should see the vouch from User A
curl -X GET http://localhost:3000/api/wallet/vouches/received \
  -H "x-user-id: USER_B_ID"
```

6. **Check Credit Eligibility**:

```bash
# User B should now be eligible (has 6 points >= 5)
curl -X GET http://localhost:3000/api/wallet/credit-eligibility \
  -H "x-user-id: USER_B_ID"
```

7. **User B Vouches for User A**:

```bash
curl -X POST http://localhost:3000/api/wallet/vouch \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER_B_ID" \
  -d '{
    "username": "user_a_username",
    "points": 2
  }'
```

8. **Final Verification**:

```bash
# User A should have 6 points (4 + 2)
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: USER_A_ID"

# User B should have 4 points (6 - 2)
curl -X GET http://localhost:3000/api/wallet/trust-points \
  -H "x-user-id: USER_B_ID"
```

---

## Testing Checklist

- [ ] GET /api/wallet/trust-points returns trust points with vouch statistics
- [ ] POST /api/wallet/vouch successfully transfers points
- [ ] POST /api/wallet/vouch fails when balance is 0
- [ ] POST /api/wallet/vouch fails when trying to vouch for yourself
- [ ] POST /api/wallet/vouch fails when insufficient points
- [ ] GET /api/wallet/vouches/received returns list of vouches
- [ ] GET /api/wallet/credit-eligibility returns eligible: true for 5+ points
- [ ] GET /api/wallet/credit-eligibility returns eligible: false for < 5 points
- [ ] POST /api/wallet/trust-points/initialize works with EVM address
- [ ] POST /api/wallet/trust-points/initialize fails without EVM address
- [ ] Notifications are created when vouches are received (check database)

---

## Database Verification

After testing, verify in the database:

```sql
-- Check user_vouches table
SELECT * FROM user_vouches ORDER BY created_at DESC;

-- Check notifications table
SELECT * FROM notifications WHERE type = 'vouch_received' ORDER BY created_at DESC;

-- Check trust_points balances
SELECT
  u.email,
  tp.balance,
  (SELECT COUNT(*) FROM user_vouches WHERE voucher_id = tp.user_id) as vouches_given,
  (SELECT COUNT(*) FROM user_vouches WHERE vouched_user_id = tp.user_id) as vouches_received
FROM trust_points tp
JOIN auth.users u ON u.id = tp.user_id;
```

---

## Troubleshooting

### Error: "Unauthorized"

- Make sure you're passing the `x-user-id` header
- Verify the user ID exists in the database

### Error: "Usuario no encontrado"

- Make sure the target username exists in the profiles table
- Check that the username matches exactly (case-sensitive)

### Error: "No tienes suficientes puntos de confianza"

- Check the user's balance in the trust_points table
- Make sure the user has enough points for the vouch

### Notifications Not Created

- Check that the trigger `on_user_vouch_created` exists
- Verify the function `notify_vouch_received()` exists
- Check database logs for errors
