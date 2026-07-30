#!/usr/bin/env bash
# Complete Vercel setup for app.sozu.capital + dev.sozu.capital pipeline
# Requires: VERCEL_TOKEN environment variable or authenticated Vercel CLI
# Usage: VERCEL_TOKEN=your_token ./scripts/complete-vercel-setup.sh

set -euo pipefail

PROJECT_NAME="sozu-credit"
PROD_DOMAIN="app.sozu.capital"
STAGING_DOMAIN="dev.sozu.capital"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check prerequisites
if [ -z "${VERCEL_TOKEN:-}" ]; then
  log_error "VERCEL_TOKEN environment variable not set"
  echo ""
  echo "Please create a token at: https://vercel.com/account/tokens"
  echo "Then run: VERCEL_TOKEN=your_token $0"
  echo ""
  echo "Or add it to Cursor Dashboard → Cloud Agents → Secrets:"
  echo "  Name: VERCEL_TOKEN"
  echo "  Scope: User or Team, Repository: blessedux/SozuCredit"
  exit 1
fi

# Verify Vercel CLI
if ! command -v npx &> /dev/null; then
  log_error "npx not found. Please install Node.js"
  exit 1
fi

log_info "🚀 Starting Vercel setup for $PROJECT_NAME"
echo ""

# Function to run vercel command
vcli() {
  npx vercel "$@" 2>&1
}

# Get project details
log_info "Fetching project details..."
PROJECT_ID=$(vcli projects ls --yes 2>/dev/null | grep -E "^\s*$PROJECT_NAME" | awk '{print $2}' || echo "")

if [ -z "$PROJECT_ID" ]; then
  log_error "Project $PROJECT_NAME not found. Please create it first in Vercel dashboard."
  exit 1
fi

log_success "Found project: $PROJECT_NAME ($PROJECT_ID)"
echo ""

# Step 1: Set Production environment variables
log_info "📍 Step 1: Setting Production environment variables..."

set_prod_env() {
  local name=$1
  local value=$2
  
  log_info "  Setting $name (Production)..."
  vcli env rm "$name" production --yes &>/dev/null || true
  echo "$value" | vcli env add "$name" production --yes &>/dev/null
}

set_prod_env "NEXT_PUBLIC_APP_URL" "https://$PROD_DOMAIN"
set_prod_env "NEXT_PUBLIC_RP_ID" "$PROD_DOMAIN"
set_prod_env "WALLET_CLIENT_DOMAIN" "$PROD_DOMAIN"

log_success "Production environment variables set"
echo ""

# Step 2: Set Staging environment variables
# Note: Vercel CLI uses "preview" for custom environments assigned to specific branches
log_info "📍 Step 2: Setting Staging environment variables..."

set_staging_env() {
  local name=$1
  local value=$2
  
  log_info "  Setting $name (Preview/Staging)..."
  # Preview environment is used for branches with custom environments
  vcli env rm "$name" preview --yes &>/dev/null || true
  echo "$value" | vcli env add "$name" preview --yes &>/dev/null
  
  # Also set for development (local)
  vcli env rm "$name" development --yes &>/dev/null || true
  echo "$value" | vcli env add "$name" development --yes &>/dev/null
}

set_staging_env "NEXT_PUBLIC_APP_URL" "https://$STAGING_DOMAIN"
set_staging_env "NEXT_PUBLIC_RP_ID" "$STAGING_DOMAIN"
set_staging_env "WALLET_CLIENT_DOMAIN" "$STAGING_DOMAIN"

log_success "Staging environment variables set"
echo ""

# Step 3: Add domains (this requires dashboard access, but we can try)
log_info "📍 Step 3: Checking domains..."

DOMAINS=$(vcli domains ls 2>/dev/null || echo "")

if echo "$DOMAINS" | grep -q "$PROD_DOMAIN"; then
  log_success "Production domain $PROD_DOMAIN already configured"
else
  log_warning "Production domain $PROD_DOMAIN not found"
  log_info "  Add it manually in dashboard: https://vercel.com/$PROJECT_NAME/settings/domains"
fi

if echo "$DOMAINS" | grep -q "$STAGING_DOMAIN"; then
  log_success "Staging domain $STAGING_DOMAIN already configured"
else
  log_warning "Staging domain $STAGING_DOMAIN not found"
  log_info "  Add it manually in dashboard: https://vercel.com/$PROJECT_NAME/settings/domains"
fi

echo ""

# Step 4: Verify branch configuration
log_info "📍 Step 4: Verifying branch configuration..."

GIT_BRANCHES=$(vcli git ls 2>/dev/null || echo "")

if echo "$GIT_BRANCHES" | grep -q "main"; then
  log_success "Production branch 'main' configured"
else
  log_warning "Production branch 'main' not found in Vercel git configuration"
fi

if echo "$GIT_BRANCHES" | grep -q "dev"; then
  log_success "Development branch 'dev' found"
else
  log_warning "Development branch 'dev' not found in Vercel git configuration"
  log_info "  Note: Custom Staging environment must be created in dashboard"
fi

echo ""

# Step 5: Trigger deployments
log_info "📍 Step 5: Deployment status..."

DEPLOYMENTS=$(vcli ls --yes 2>/dev/null | head -20 || echo "")

log_info "Recent deployments:"
echo "$DEPLOYMENTS" | head -5 | tail -4 || log_warning "Could not fetch deployments"

echo ""
log_info "To trigger new deployments:"
echo "  Production: git push origin main (or redeploy in dashboard)"
echo "  Staging:    git push origin dev (or redeploy in dashboard)"

echo ""

# Summary and next steps
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "Environment variables configured successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_warning "MANUAL STEPS STILL REQUIRED:"
echo ""
echo "1. Create custom Staging environment:"
echo "   → https://vercel.com/$PROJECT_NAME/settings/git"
echo "   → Custom Environments → Create 'Staging'"
echo "   → Assign branch: dev"
echo ""
echo "2. Add/verify domains:"
echo "   → https://vercel.com/$PROJECT_NAME/settings/domains"
echo "   → Add $PROD_DOMAIN (Production)"
echo "   → Add $STAGING_DOMAIN (Staging environment)"
echo ""
echo "3. Copy shared secrets to Staging (if missing):"
echo "   → AUTH_SECRET"
echo "   → SEP10_CLIENT_SIGNING_SECRET"
echo "   → All Supabase, Stellar, SDP variables"
echo ""
echo "4. Trigger deployments and run smoke tests:"
echo "   → See docs/vercel-migration-runbook.md Part 4"
echo ""
log_info "Full instructions: docs/vercel-migration-runbook.md"
echo ""
