# TODO - Feature Development Roadmap

This document tracks high-priority features and improvements for the SozuCredit platform.

## 🔥 High Priority

### 1. Phone Number Login with SMS 2FA
**Status:** Not Started  
**Priority:** High  
**Target:** Devices without passkey support

**Description:**
Implement an alternative authentication method for users who don't have passkey support on their devices. This will enable broader platform access while maintaining security.

**Requirements:**
- Phone number input and validation
- SMS code generation and delivery
- SMS verification with 2FA
- Integration with existing authentication system
- Fallback authentication flow when passkeys are unavailable
- User preference selection (passkey vs SMS)

**Technical Considerations:**
- SMS provider integration (Twilio, AWS SNS, or similar)
- Rate limiting for SMS requests
- Phone number verification and storage
- Security measures against SMS interception
- Cost management for SMS delivery

**Dependencies:**
- SMS service provider account
- Phone number validation service
- Database schema updates for phone numbers

---

## 📊 Core Features

### 2. Expenditure Management
**Status:** Not Started  
**Priority:** Medium-High

**Description:**
A comprehensive system for users to track and manage their expenses, enabling better financial planning and budgeting.

**Requirements:**
- Expense categorization (food, transport, utilities, etc.)
- Manual expense entry
- Automatic expense categorization (via ML/AI if possible)
- Expense history and search
- Monthly/yearly expense reports
- Budget setting and tracking
- Expense alerts and notifications
- Export functionality (CSV, PDF)

**Technical Considerations:**
- Database schema for expenses
- Expense categorization logic
- Reporting and analytics
- Data visualization components

---

### 3. Visual Cashflow
**Status:** Not Started  
**Priority:** Medium-High

**Description:**
Interactive visualizations showing cash flow trends, income vs expenses, and financial health indicators.

**Requirements:**
- Income vs expense charts
- Cash flow timeline (daily, weekly, monthly, yearly views)
- Trend analysis and forecasting
- Visual indicators for financial health
- Interactive charts and graphs
- Comparison views (month-over-month, year-over-year)
- Export visualizations as images

**Technical Considerations:**
- Chart library integration (Recharts, Chart.js, D3.js)
- Data aggregation and processing
- Real-time data updates
- Mobile-responsive visualizations

**Dependencies:**
- Expenditure Management (Feature #2)
- Income tracking system

---

### 4. Loan Request and Payback Traceability
**Status:** Not Started  
**Priority:** Medium

**Description:**
Complete system for loan management, including request submission, approval workflow, disbursement tracking, and repayment traceability.

**Requirements:**
- Loan request form and submission
- Loan application status tracking
- Approval/rejection workflow
- Loan disbursement tracking
- Repayment schedule management
- Payment history and tracking
- Reminder notifications for payments
- Loan terms and conditions management
- Credit score impact tracking
- Loan analytics and reporting

**Technical Considerations:**
- Loan calculation engine (interest, fees, etc.)
- Payment processing integration
- Notification system
- Document management for loan agreements
- Audit trail for all loan-related actions

**Dependencies:**
- User authentication system
- Wallet system (existing)
- Payment processing infrastructure

---

## 💱 Financial Operations

### 5. Onramp and Offramp
**Status:** Not Started  
**Priority:** Medium

**Description:**
Enable users to convert between fiat currencies (USD, ARS, etc.) and digital assets (XLM, Stellar tokens) seamlessly.

**Requirements:**
- Fiat to crypto (Onramp) functionality
  - Bank transfer integration
  - Credit/debit card processing
  - Supported currencies (USD, ARS, etc.)
  - Real-time exchange rates
  - Transaction limits and KYC compliance
  
- Crypto to fiat (Offramp) functionality
  - Bank withdrawal processing
  - Supported currencies
  - Withdrawal limits and verification
  - Transaction fees and pricing transparency
  
- Exchange rate management
- Transaction history and tracking
- Compliance and regulatory requirements (KYC/AML)
- Multi-currency support

**Technical Considerations:**
- Payment processor integration (Stripe, PayPal, etc.)
- Fiat gateway services
- Regulatory compliance tools
- Exchange rate APIs
- Transaction monitoring and fraud detection
- Secure payment handling

**Dependencies:**
- Stellar wallet integration (existing)
- Payment processor accounts
- Compliance verification systems

---

## 📝 Notes

- All features should maintain the existing security standards
- Mobile responsiveness is required for all features
- Consider accessibility (WCAG 2.1 AA compliance)
- Performance optimization for all new features
- Comprehensive testing (unit, integration, E2E) required

## 🔄 Future Considerations

- Multi-language support
- Advanced analytics and AI-powered insights
- Social features (sharing, referrals)
- Mobile app development (iOS/Android)
- API for third-party integrations

---

**Last Updated:** 2025-01-23  
**Maintained By:** Development Team

