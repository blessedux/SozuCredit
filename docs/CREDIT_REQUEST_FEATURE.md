# Credit Request Feature

This document outlines the credit request feature implementation for Sozu Credit.

## Overview

The credit request feature allows users to request microloans based on their trust score, vouches, and community reputation. This replaces traditional credit checks with community-based vouching.

## User Flow

1. **User requests credit** → Fill out credit request form
2. **System evaluates eligibility** → Based on trust points, vouches, and MaxFlow ego score
3. **Community review** → Other users can vouch for the request
4. **Approval/Rejection** → Automated or manual approval based on criteria
5. **Disbursement** → Funds sent to user's Stellar wallet
6. **Repayment tracking** → Monitor payments and schedule

## Database Schema

### Credit Requests Table

```sql
CREATE TABLE credit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(20, 7) NOT NULL,
  purpose TEXT,
  repayment_period_days INTEGER NOT NULL,
  interest_rate NUMERIC(5, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'repaid', 'defaulted')),
  trust_score_required NUMERIC(5, 2),
  vouches_received INTEGER DEFAULT 0,
  vouches_required INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  disbursed_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);

CREATE INDEX idx_credit_requests_user_id ON credit_requests(user_id);
CREATE INDEX idx_credit_requests_status ON credit_requests(status);
```

### Loans Table

```sql
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_request_id UUID NOT NULL REFERENCES credit_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  principal_amount NUMERIC(20, 7) NOT NULL,
  interest_rate NUMERIC(5, 2) NOT NULL,
  total_amount NUMERIC(20, 7) NOT NULL,
  amount_paid NUMERIC(20, 7) DEFAULT 0,
  amount_remaining NUMERIC(20, 7) NOT NULL,
  repayment_period_days INTEGER NOT NULL,
  daily_payment_amount NUMERIC(20, 7),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue', 'defaulted')),
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(due_date);
```

### Loan Payments Table

```sql
CREATE TABLE loan_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(20, 7) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_hash TEXT,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user_id ON loan_payments(user_id);
```

### Credit Request Vouches Table

```sql
CREATE TABLE credit_request_vouches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_request_id UUID NOT NULL REFERENCES credit_requests(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trust_points_spent INTEGER DEFAULT 1,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(credit_request_id, voucher_id)
);

CREATE INDEX idx_credit_request_vouches_request_id ON credit_request_vouches(credit_request_id);
CREATE INDEX idx_credit_request_vouches_voucher_id ON credit_request_vouches(voucher_id);
```

## API Endpoints

### Credit Requests

- `POST /api/credit/request` - Create a new credit request
- `GET /api/credit/requests` - Get user's credit requests
- `GET /api/credit/requests/[id]` - Get specific credit request
- `POST /api/credit/requests/[id]/vouch` - Vouch for a credit request
- `POST /api/credit/requests/[id]/approve` - Approve a credit request (admin/system)
- `POST /api/credit/requests/[id]/reject` - Reject a credit request (admin/system)

### Loans

- `GET /api/credit/loans` - Get user's active loans
- `GET /api/credit/loans/[id]` - Get specific loan details
- `POST /api/credit/loans/[id]/pay` - Make a loan payment
- `GET /api/credit/loans/[id]/payments` - Get loan payment history

## Eligibility Criteria

### Minimum Requirements

- Trust points: ≥ 10 points
- Vouches received: ≥ 3 vouches
- MaxFlow ego score: ≥ 1.0 (if EVM address linked)
- Education completion: At least "Introduction to Micro-Credit" course

### Credit Limits

- Base limit: $100
- Trust points multiplier: +$10 per trust point above 10
- Vouches multiplier: +$20 per vouch above 3
- MaxFlow ego score multiplier: +$50 per point above 1.0
- Education multiplier: +$50 per completed course

### Example Calculation

- User has 25 trust points, 5 vouches, ego score 2.5, completed 3 courses
- Base: $100
- Trust: (25 - 10) × $10 = $150
- Vouches: (5 - 3) × $20 = $40
- Ego: (2.5 - 1.0) × $50 = $75
- Education: 3 × $50 = $150
- **Total Credit Limit: $515**

## Interest Rates

- Base rate: 5% APR
- Trust score discount: -0.1% per trust point above 10
- Vouches discount: -0.2% per vouch above 3
- Minimum rate: 2% APR
- Maximum rate: 10% APR

## Repayment Terms

- Minimum period: 30 days
- Maximum period: 365 days
- Default period: 90 days
- Daily payment option available
- Early repayment discount: 1% of remaining principal

## Implementation Phases

### Phase 1: Database & API (Week 1)

- [ ] Create database schema
- [ ] Create API endpoints for credit requests
- [ ] Implement eligibility calculation
- [ ] Add credit request creation

### Phase 2: UI Components (Week 2)

- [ ] Credit request form
- [ ] Credit request list/dashboard
- [ ] Credit request detail page
- [ ] Vouching interface for requests

### Phase 3: Approval & Disbursement (Week 3)

- [ ] Automated approval logic
- [ ] Manual review interface (if needed)
- [ ] Disbursement to Stellar wallet
- [ ] Transaction tracking

### Phase 4: Repayment System (Week 4)

- [ ] Payment interface
- [ ] Payment tracking
- [ ] Reminder notifications
- [ ] Overdue handling

## Next Steps

1. Create database migration script
2. Implement credit request API
3. Build credit request form UI
4. Add eligibility calculation logic
5. Integrate with existing trust points and vouching system
