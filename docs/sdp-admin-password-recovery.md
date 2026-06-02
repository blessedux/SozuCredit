# SDP admin password recovery (Railway production)

SDP does **not** store plaintext passwords. There is no env var on Railway for `SDP_ADMIN_PASSWORD` — that value only exists in **your** Vercel / `.env.local` and must match the **user row** in SDP’s Postgres (`auth_users.encrypted_password`, bcrypt).

## Why forgot-password email does nothing

On Railway, `EMAIL_SENDER_TYPE=DRY_RUN` for the sdp-api service. The API returns HTTP 200, but the reset link is **logged**, not emailed.

## Reset flow (recommended)

From SozuCredit repo:

```bash
# 1) Create reset token (logged on Railway)
node scripts/sdp-reset-password.mjs request

# 2) Railway → sdp-v2 → Logs → search "reset-password" or "token="
#    Copy token from URL in log line

# 3) Set new password (12–36 chars, upper, lower, digit, symbol)
node scripts/sdp-reset-password.mjs apply --token='<token>' --password='SozuAdmin2026!'

# 4) Sync env everywhere
#    SDP_ADMIN_PASSWORD=<same password> in SozuCredit + SozuPay .env.local and Vercel

# 5) Verify
node scripts/sdp-diagnose-admin-env.mjs
node scripts/sdp-lookup-receiver-dob.mjs 'beneficiary@example.com'
```

## Railway variables (what they mean)

| Railway (sdp-v2) | Purpose |
|------------------|---------|
| `ADMIN_API_KEY` | Basic auth for **creating tenants** (`POST /admin/tenants`), not dashboard login |
| `ADMIN_ACCOUNT` | Usually `SDP-admin` (username for basic auth) |
| `SEP10_SIGNING_PRIVATE_KEY` | Wallet invites — **not** NGO login password |

Copy `ADMIN_API_KEY` into local `.env.local` as `SDP_ADMIN_API_KEY` only to run `node scripts/sdp-list-tenants.mjs`.

## Common mistake

Generating a random string and setting `SDP_ADMIN_PASSWORD` in Vercel **does not** change SDP. Until you reset via `reset-password` (or SDP UI), login will keep returning 401.
