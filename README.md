# Sozu Credit

**Vouched, not Verified. Credit for everyone.**

> A simple, passkeys-powered wallet that gives entrepreneurs instant access to high-yield DeFi and unlocks decentralized credit through community vouching and education.

---

## 🎯 Value Proposition

**Sozu Credit** is a next-generation financial platform that combines:

- ✅ **Simple UX** — One-tap access, no passwords, no complexity
- 🔐 **Passkeys Powered** — Secure, instant login with biometric authentication (no passwords, no KYC)
- 💰 **High-Yield DeFi** — Automatic 10-20% APY on USDC holdings via Stellar smart wallets
- 📚 **Education Gateway** — Learn to unlock decentralized credit opportunities
- 🤝 **Community Vouching** — Get vouched by other users to access credit based on trust, not traditional credit scores

### What Makes Us Different?

1. **No Passwords, No KYC** — Sign in instantly with your fingerprint or face ID via passkeys
2. **Earn While You Hold** — Your USDC automatically earns 10-20% APY in DeFi vaults
3. **Community-Based Credit** — Access microloans through vouching from other entrepreneurs, not banks
4. **Learn While You Earn** — Educational courses unlock higher credit limits and opportunities
5. **Simple & Fast** — Beautiful, minimal design that works offline and on any device

---

## 🚀 Quick Start

### For Users

1. **Sign Up** — Tap to create account with passkeys (no email, no password)
2. **Receive USDC** — Get paid directly to your Stellar smart wallet
3. **Earn Yield** — Funds automatically earn 10-20% APY in defivaults
4. **Get Vouched** — Invite others or get vouched to build your trust score
5. **Unlock Credit** — Complete education modules to access decentralized credit pools

### For Developers

```bash
# Clone repository
git clone https://github.com/sozu-capital/sozu-credit.git
cd sozu-credit

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run development server
pnpm dev
```

See [Local Development](#local-development) for detailed setup instructions.

---

## 💡 Core Features

### 1. **Passkeys Authentication**

- 🔒 Zero passwords — sign in with biometrics (fingerprint, face ID, or hardware key)
- ⚡ Instant access — no email verification, no SMS codes
- 🛡️ More secure than traditional passwords
- 🌍 Works on all devices (mobile, desktop, hardware keys)

### 2. **Stellar Smart Wallets**

- 💼 Automatic wallet creation per user
- 💵 USDC on Stellar network
- 📊 Real-time balance tracking
- 🔄 Seamless deposits and withdrawals

### 3. **High-Yield DeFi Vaults**

- 🏦 Automatic 10-20% APY on USDC
- 🔄 Auto-deposit incoming funds to yield vaults
- 📈 Real-time yield tracking
- 💸 Easy withdrawals anytime

### 4. **Trust Points & Vouching**

- 🏅 Earn trust points through community vouching
- 🤝 Vouch for other users to build reputation
- 📊 Trust score determines credit eligibility
- 🎁 Bonus points for daily activities and referrals

### 5. **Education Portal**

- 📚 Financial literacy courses
- 🎓 Complete modules to unlock credit
- 📈 Learn DeFi and blockchain basics
- 🏆 Achieve certifications for better rates

### 6. **Decentralized Credit**

- 💳 Access microloans based on community vouching
- 🎯 No traditional credit checks
- ⚡ Fast approval and disbursement
- 📊 Transparent terms and rates

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│         Frontend (Next.js PWA)      │
│  ┌──────────────────────────────┐  │
│  │  Passkeys Auth (WebAuthn)    │  │
│  │  Stellar Wallet UI           │  │
│  │  DeFi Vault Dashboard        │  │
│  │  Trust Points & Vouching     │  │
│  │  Education Portal            │  │
│  └──────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      API Layer (Next.js Edge)        │
│  • Wallet Management                │
│  • Vault Operations                 │
│  • Trust Points API                 │
│  • Education Progress               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Stellar Blockchain              │
│  • Smart Wallets                     │
│  • USDC Asset Management            │
│  • DeFi Vault Integration           │
│  • Transaction Settlement           │
└──────────────────────────────────────┘
```

### Tech Stack

**Frontend**

- Next.js 14+ (App Router)
- React + TypeScript
- Tailwind CSS
- WebAuthn/Passkeys
- PWA support (offline-first)

**Backend**

- Next.js API Routes (Edge Runtime)
- Supabase (PostgreSQL + Auth)
- Stellar SDK
- DeFi Protocol SDKs (Blend/Stellar AMM)

**Blockchain**

- Stellar Network
- Soroban Smart Contracts (future)
- USDC on Stellar

---

## 📱 User Flow

### New User Journey

1. **Sign Up** → Tap fingerprint/face ID → Wallet created instantly
2. **Get Invite Link** → Share with others → Receive trust points
3. **Receive USDC** → Funds auto-deposit to yield vault → Earn 10-20% APY
4. **Complete Education** → Learn DeFi basics → Unlock credit eligibility
5. **Get Vouched** → Build trust score → Access credit pools
6. **Request Credit** → Community vouching determines terms → Receive funds

### Existing User Flow

- View balance (wallet + vault combined)
- Track yield earnings in real-time
- Vouch for other users
- Send/receive USDC instantly
- Manage credit and repayments

---

## 🔐 Security & Privacy

- **Passkeys Only** — No passwords stored, biometric authentication only
- **Encrypted Keys** — Stellar wallet keys encrypted at rest
- **Self-Custody** — Users control their funds
- **Zero-Knowledge UX** — Minimal data collection, maximum privacy
- **Community-Based** — No KYC required for vouching-based credit

---

## 🎓 Education System

Complete courses to unlock credit opportunities:

- ✅ **Introduction to Micro-Credit** — Basics of decentralized lending
- ✅ **Financial Responsibility** — Loan repayment and planning
- ✅ **Business Planning** — Create solid business plans
- ✅ **Community & Trust** — Understanding the vouching system
- ✅ **Managing Your Funds** — Best practices for DeFi funds

**Progress = Credit Eligibility** — Complete all courses to unlock full credit limits.

---

## 🤝 Community Vouching

### How It Works

1. **Earn Trust Points** — Start with 5 points, earn more through:

   - Daily bonuses
   - Inviting new users
   - Receiving vouches from others

2. **Vouch for Others** — Give trust points to users you believe in

   - Each vouch increases their trust score
   - Your vouches build your reputation

3. **Unlock Credit** — Higher trust scores = better credit terms
   - Community vouching replaces traditional credit checks
   - Transparent trust graph visible to all

### Invite System

- **Share Your Invite Link** — Get unique URL to share
- **New Users Join** — They can vouch for you or you can vouch for them
- **Build Your Network** — Stronger network = more credit opportunities

---

## 💰 DeFi Integration

### Yield Vaults (10-20% APY)

- **Automatic Deposits** — Incoming USDC automatically goes to vault
- **High Yield** — Earn 10-20% APY on idle funds
- **Easy Withdrawals** — Access your funds anytime
- **Real-Time Tracking** — See your earnings grow daily

### Supported Protocols

- **Blend Protocol** — Stellar-based lending
- **Stellar AMM** — Automated market maker pools
- **Future Integrations** — Additional protocols coming soon

---

## 📊 Database Schema

### Core Tables

- **Users** — Passkeys, Stellar wallets, profiles
- **Trust Points** — Balance, vouches, reputation
- **USDC Holdings** — Wallet balance + vault balance
- **Vault Deposits** — Deposit history, yield earnings
- **Vouches** — Who vouched for whom, trust points transferred
- **Education Progress** — Course completions, certifications

See `scripts/001_create_schema.sql` for full schema.

---

## 🛠️ Local Development

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Supabase account (or local PostgreSQL)

### Setup

```bash
# 1. Clone repository
git clone https://github.com/sozu-capital/sozu-credit.git
cd sozu-credit

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Set required environment variables
# See .env.example for full list

# 5. Run database migrations
# (If using Supabase, migrations run automatically)
# Or run scripts in /scripts directory

# 6. Start development server
pnpm dev
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stellar
STELLAR_NETWORK=testnet  # or 'mainnet'
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# USDC Asset
USDC_ASSET_CODE=USDC
USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN

# Vault Protocol
VAULT_PROTOCOL=blend  # or 'stellar_amm'
VAULT_MIN_DEPOSIT=10
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run E2E tests
pnpm test:e2e
```

---

## 📈 Roadmap

### ✅ Phase 1: Foundation (Completed)

- Passkeys authentication
- Stellar wallet creation
- Trust points & vouching
- Basic UI/UX

### 🚧 Phase 2: DeFi Integration (In Progress)

- USDC asset setup
- Yield vault integration
- Auto-deposit logic
- Balance aggregation

### 📅 Phase 3: Education Portal

- Course modules
- Progress tracking
- Certification system
- Credit unlocking

### 📅 Phase 4: Credit Pools

- Decentralized credit contracts
- Disbursement system
- Repayment tracking
- Trust score integration

### 📅 Phase 5: Advanced Features

- Multi-asset support
- Payment links
- Receipt OCR
- AI financial assistant

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines

- Use TypeScript for all new code
- Follow existing code style (ESLint + Prettier)
- Write tests for new features
- Update documentation as needed

---

## 📄 License

- **Code**: Apache-2.0
- **Smart Contracts**: MIT or Apache-2.0

---

## 🙋 Support

- **Documentation**: See `/docs` directory
- **Issues**: [GitHub Issues](https://github.com/sozu-capital/sozu-credit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sozu-capital/sozu-credit/discussions)

---

## 🎯 Mission

**Sozu Credit** believes that credit should be accessible to everyone, not just those with traditional credit scores. Through community vouching, education, and DeFi integration, we're building a more inclusive financial system where trust and reputation matter more than paperwork.

**Vouched, not Verified. Credit for everyone.**

---

## 📚 Additional Resources

- [Defindex/Blend Protocol Plan](./DEFINDEX_BLEND_PROTOCOL_PLAN.md)
- [Auth Flow Documentation](./AUTH_FLOW_FIX.md)
- [Testing Guide](./TESTING_AUTH_FLOW.md)
- [Mobile Optimization](./MOBILE_ANIMATION_OPTIMIZATION.md)
