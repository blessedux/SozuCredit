#!/usr/bin/env bash
# Vercel environment variable setup script for app/dev pipeline
# Usage: ./scripts/vercel-set-env-vars.sh
# Requires: Vercel CLI authenticated (`npx vercel login` first)

set -euo pipefail

PROJECT="sozu-credit"
PROD_ENV="production"
STAGING_ENV="preview,development" # Vercel uses "preview" for custom Staging
PREVIEW_ENV="preview,development"

echo "🚀 Setting Vercel environment variables for $PROJECT"
echo ""
echo "Prerequisites:"
echo "  1. Vercel CLI authenticated: npx vercel login"
echo "  2. Staging environment created in Vercel dashboard"
echo "  3. dev branch assigned to Staging environment"
echo ""

# Check if Vercel CLI is available
if ! command -v vercel &> /dev/null && ! command -v npx &> /dev/null; then
  echo "❌ Error: Vercel CLI not available. Install with: npm i -g vercel"
  exit 1
fi

# Function to set env var
set_env() {
  local name=$1
  local value=$2
  local env=$3
  
  echo "  Setting $name for $env..."
  npx vercel env add "$name" "$env" --yes <<< "$value" 2>/dev/null || \
    npx vercel env rm "$name" "$env" --yes && \
    npx vercel env add "$name" "$env" --yes <<< "$value"
}

# Function to prompt for sensitive value
prompt_secret() {
  local name=$1
  local env=$2
  read -rsp "  Enter $name for $env (hidden): " value
  echo ""
  if [ -z "$value" ]; then
    echo "  ⚠️  Skipped (empty)"
    return
  fi
  set_env "$name" "$value" "$env"
}

echo "📍 Step 1: Environment-specific URL/RP ID variables (CRITICAL)"
echo "   These MUST differ due to passkey origin binding."
echo ""

echo "Setting Production environment variables..."
set_env "NEXT_PUBLIC_APP_URL" "https://app.sozu.capital" "$PROD_ENV"
set_env "NEXT_PUBLIC_RP_ID" "app.sozu.capital" "$PROD_ENV"
set_env "WALLET_CLIENT_DOMAIN" "app.sozu.capital" "$PROD_ENV"
echo "✅ Production URLs set"
echo ""

echo "Setting Staging environment variables..."
set_env "NEXT_PUBLIC_APP_URL" "https://dev.sozu.capital" "$STAGING_ENV"
set_env "NEXT_PUBLIC_RP_ID" "dev.sozu.capital" "$STAGING_ENV"
set_env "WALLET_CLIENT_DOMAIN" "dev.sozu.capital" "$STAGING_ENV"
echo "✅ Staging URLs set"
echo ""

echo "📍 Step 2: Optional host-bound callback URLs"
echo "   Press Enter to skip if you want auto-constructed URLs."
echo ""

read -rp "Set explicit Google OAuth redirect URI? (y/N): " set_google
if [[ "$set_google" =~ ^[Yy]$ ]]; then
  set_env "GOOGLE_REDIRECT_URI" "https://app.sozu.capital/api/gmail/callback" "$PROD_ENV"
  set_env "GOOGLE_REDIRECT_URI" "https://dev.sozu.capital/api/gmail/callback" "$STAGING_ENV"
  echo "✅ Google redirect URIs set"
else
  echo "  ⚠️  Skipped (will auto-construct from NEXT_PUBLIC_APP_URL)"
fi
echo ""

read -rp "Set explicit SumUp callback URLs? (y/N): " set_sumup
if [[ "$set_sumup" =~ ^[Yy]$ ]]; then
  set_env "SUMUP_WEBHOOK_URL" "https://app.sozu.capital/api/deposits/sumup/webhook" "$PROD_ENV"
  set_env "SUMUP_REDIRECT_URL" "https://app.sozu.capital/deposit/return" "$PROD_ENV"
  set_env "SUMUP_WEBHOOK_URL" "https://dev.sozu.capital/api/deposits/sumup/webhook" "$STAGING_ENV"
  set_env "SUMUP_REDIRECT_URL" "https://dev.sozu.capital/deposit/return" "$STAGING_ENV"
  echo "✅ SumUp callback URLs set"
else
  echo "  ⚠️  Skipped (will auto-construct from NEXT_PUBLIC_APP_URL)"
fi
echo ""

echo "📍 Step 3: Shared environment variables"
echo "   The following are typically set on ALL environments (Production + Staging + Preview)."
echo "   This script will help you set missing Staging values."
echo ""

echo "Checking for Production-only variables that need Staging copies..."
echo ""

# Check if AUTH_SECRET exists in Staging
if ! npx vercel env ls | grep -q "AUTH_SECRET.*$STAGING_ENV"; then
  echo "⚠️  AUTH_SECRET not found in Staging"
  read -rp "Copy from Production to Staging? (Y/n): " copy_auth
  if [[ ! "$copy_auth" =~ ^[Nn]$ ]]; then
    prompt_secret "AUTH_SECRET" "$STAGING_ENV"
  fi
fi

# Check if SEP10_CLIENT_SIGNING_SECRET exists in Staging
if ! npx vercel env ls | grep -q "SEP10_CLIENT_SIGNING_SECRET.*$STAGING_ENV"; then
  echo "⚠️  SEP10_CLIENT_SIGNING_SECRET not found in Staging"
  read -rp "Copy from Production to Staging? (Y/n): " copy_sep10
  if [[ ! "$copy_sep10" =~ ^[Nn]$ ]]; then
    prompt_secret "SEP10_CLIENT_SIGNING_SECRET" "$STAGING_ENV"
  fi
fi

echo ""
echo "✅ Environment variable setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Verify in Vercel dashboard: https://vercel.com/blessedux/sozu-credit/settings/environment-variables"
echo "  2. Trigger redeployment: npx vercel --prod (Production) or npx vercel (Preview/Staging)"
echo "  3. Run smoke tests: docs/vercel-migration-runbook.md Part 4"
echo ""
