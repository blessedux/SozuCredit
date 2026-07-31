# Sozu Wallet

**Self-custodial Stellar USDC wallet** — passkeys, Pay, Deposit. Closed beta at [app.sozu.capital](https://app.sozu.capital).

> Staging: [dev.sozu.capital](https://dev.sozu.capital) · Production (closed beta): [app.sozu.capital](https://app.sozu.capital)  
> Pipeline: one GitHub repo, one Vercel project — see [docs/vercel-consolidation.md](./docs/vercel-consolidation.md).

---

## Product note

The live demo shell is **USDC Pay + Deposit** with passkey auth. Broader credit / DeFi / vouching work remains in the codebase and roadmaps under `docs/`; first-run UX should match the wallet demo.

## Quick Start

### For Users

1. Open [app.sozu.capital](https://app.sozu.capital)
2. Create / sign in with a passkey
3. Deposit or claim testnet faucet USDC
4. Pay from Home

### For Developers

```bash
# Clone repository (after rename: blessedux/sozu-wallet)
git clone https://github.com/blessedux/SozuCredit.git
cd SozuCredit

# Install dependencies
pnpm install

# Create environment file (see Local development)
cp .env.example .env.local

# Run development server
pnpm dev
```

Deploy / Staging / Production cutover: [docs/vercel-consolidation.md](./docs/vercel-consolidation.md).  
See [Local Development](#local-development) for detailed setup instructions.

---

## 💡 Core Features

### 1. **Passkeys Authentication**

- 🔒 Zero passwords — sign in with biometrics (fingerprint, face ID, or hardware key)
- ⚡ Instant access — no email verification, no SMS codes
- 🛡️ More secure than traditional passwords
- 🌍 Works on all devices (mobile, desktop, hardware keys)

### 2. **Stellar Smart Wallets**

- 💼 Automatic wallet creation per user via Turnkey SDK
- 🔐 Secure key management - private keys managed by Turnkey
- 💵 USDC on Stellar network
- 📊 Real-time balance tracking via Stellar Horizon API
- 🔄 Seamless deposits and withdrawals
- 🌐 Testnet and mainnet support

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

## 📊 Database schema

Authoritative DDL lives in **`supabase/migrations/`** (apply via Supabase CLI or dashboard). Feature areas include profiles and passkeys, trust and vouches, Stellar wallet metadata, Gmail-derived ledger tables, and vault/category extensions.

See **[Email ledger and Gmail](./docs/email-ledger-and-gmail.md)** for the ingestion model.

---

## Local development

Create `.env.local` at the repo root. Typical variables:

```env
# Turnkey (dashboard API key — store securely; private material is shown once)
NEXT_PUBLIC_TURNKEY_API_BASE_URL=https://api.turnkey.com
NEXT_PUBLIC_TURNKEY_ORG_ID=
NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY=
NEXT_PUBLIC_TURNKEY_API_PRIVATE_KEY=

# Stellar (classic)
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
USDC_ASSET_CODE=USDC
USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN

# Vault / strategy integration (see docs)
VAULT_PROTOCOL=blend
VAULT_MIN_DEPOSIT=10

# Gmail linking (Settings). See docs/email-ledger-and-gmail.md
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
# GOOGLE_CLIENT_ID=          # alternative to GOOGLE_OAUTH_CLIENT_ID
# GOOGLE_CLIENT_SECRET=       # alternative to GOOGLE_OAUTH_CLIENT_SECRET
# GOOGLE_REDIRECT_URI=        # optional; must match Google Cloud OAuth client if set
```

Soroban / DeFindex variables are documented in **[Wallet, Stellar, and DeFindex](./docs/wallet-stellar-defindex.md)**.

---

## 📚 Documentation index

Full index: **[docs/README.md](./docs/README.md)**

| Topic | Guide |
|--------|--------|
| **Privacy wallet roadmap (Phases 1–10)** | [docs/privacy-wallet-roadmap.md](./docs/privacy-wallet-roadmap.md) |
| Architecture and platform | [docs/architecture-and-platform.md](./docs/architecture-and-platform.md) |
| Authentication and accounts | [docs/authentication-and-accounts.md](./docs/authentication-and-accounts.md) |
| Wallet, Stellar, DeFindex | [docs/wallet-stellar-defindex.md](./docs/wallet-stellar-defindex.md) |
| Email ledger and Gmail | [docs/email-ledger-and-gmail.md](./docs/email-ledger-and-gmail.md) |
| Payments and settlement | [docs/payments-and-settlement.md](./docs/payments-and-settlement.md) |
| Treasury purchasing power engine | [docs/treasury-purchasing-power.md](./docs/treasury-purchasing-power.md) |
| Trust, vouches, credit | [docs/community-trust-and-credit.md](./docs/community-trust-and-credit.md) |
| Development (PWA icons, scripts, testing) | [docs/development-guide.md](./docs/development-guide.md) |
| Consolidated history note | [docs/project-history.md](./docs/project-history.md) |
| Ledger merchant categorization (LLM) | [lib/ledger/merchant-categorization-llm-rules.md](./lib/ledger/merchant-categorization-llm-rules.md) |

---

## 📈 Roadmap

Two roadmaps apply to this product:

1. **Privacy + compliance stack (Phases 1–10)** — passkeys, smart accounts, credentials, rotating addresses, ZK compliance, shielded treasury. Canonical doc: **[docs/privacy-wallet-roadmap.md](./docs/privacy-wallet-roadmap.md)**.
2. **Sozu Credit product features (below)** — DeFi, education, community credit, and UX milestones.

### ✅ Product Phase 1: Foundation (Completed)

- Passkeys authentication
- Stellar wallet creation
- Trust points & vouching
- Basic UI/UX

### 🚧 Product Phase 2: DeFi Integration (In Progress)

- USDC asset setup
- Yield vault integration
- Auto-deposit logic
- Balance aggregation

### 📅 Product Phase 3: Education Portal

- Course modules
- Progress tracking
- Certification system
- Credit unlocking

### 📅 Product Phase 4: Credit Pools

- Decentralized credit contracts
- Disbursement system
- Repayment tracking
- Trust score integration

### 📅 Product Phase 5: Advanced Features

- Multi-asset support
- Payment links
- Receipt OCR
- AI financial assistant

---

## 🎯 Mission

**Sozu Credit** believes that credit should be accessible to everyone, not just those with traditional credit scores. Through community vouching, education, and DeFi integration, we're building a more inclusive financial system where trust and reputation matter more than paperwork.

**Vouched, not Verified. Credit for everyone.**

