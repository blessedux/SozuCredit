#!/usr/bin/env bash
# Sozu Faucet vault ops (testnet).
#
# Usage:
#   ./scripts/faucet-vault.sh treasury         # treasury G address + balances
#   ./scripts/faucet-vault.sh balance          # vault USDC balance + default claim amount
#   ./scripts/faucet-vault.sh fund 50          # move 50 USDC from treasury into the vault
#   ./scripts/faucet-vault.sh withdraw 10      # pull 10 USDC back to the treasury
#   ./scripts/faucet-vault.sh set-amount 0.5   # set contract default claim amount
#
# Reads FAUCET_CONTRACT_ID / FAUCET_TOKEN_CONTRACT_ID / FAUCET_TREASURY_SECRET
# (fallback STELLAR_FUNDER_SECRET) from .env.local. Requires the stellar CLI.

set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^\s*$1=" .env.local | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true; }

CONTRACT_ID="$(envval FAUCET_CONTRACT_ID)"
TOKEN_ID="$(envval FAUCET_TOKEN_CONTRACT_ID)"
SECRET="$(envval FAUCET_TREASURY_SECRET)"
[ -z "$SECRET" ] && SECRET="$(envval STELLAR_FUNDER_SECRET)"

[ -z "$CONTRACT_ID" ] && { echo "FAUCET_CONTRACT_ID missing in .env.local" >&2; exit 1; }
[ -z "$SECRET" ] && { echo "FAUCET_TREASURY_SECRET / STELLAR_FUNDER_SECRET missing in .env.local" >&2; exit 1; }

TREASURY_PK="$(node -e "const{Keypair}=require('@stellar/stellar-sdk');console.log(Keypair.fromSecret('$SECRET').publicKey())")"

to_minor() { python3 -c "import sys; print(int(round(float(sys.argv[1]) * 10**7)))" "$1"; }
from_minor() { python3 -c "import sys; print(int(sys.argv[1]) / 10**7)" "$1"; }

invoke() { stellar contract invoke --id "$CONTRACT_ID" --source-account "$SECRET" --network testnet -- "$@"; }

case "${1:-}" in
  treasury)
    echo "Treasury G: $TREASURY_PK"
    curl -s "https://horizon-testnet.stellar.org/accounts/$TREASURY_PK" \
      | python3 -c "import json,sys; j=json.load(sys.stdin); [print(' ', (b.get('asset_code') or 'XLM'), b['balance']) for b in j.get('balances', [])]"
    ;;
  balance)
    echo "Vault contract: $CONTRACT_ID"
    echo "USDC balance:        $(from_minor "$(invoke balance 2>/dev/null | tr -d '\"')")"
    echo "Default claim amount: $(from_minor "$(invoke claim_amount 2>/dev/null | tr -d '\"')")"
    ;;
  fund)
    [ -z "${2:-}" ] && { echo "usage: $0 fund <usdc_amount>" >&2; exit 1; }
    [ -z "$TOKEN_ID" ] && { echo "FAUCET_TOKEN_CONTRACT_ID missing in .env.local" >&2; exit 1; }
    MINOR="$(to_minor "$2")"
    echo "Transferring $2 USDC from treasury -> vault…"
    stellar contract invoke --id "$TOKEN_ID" --source-account "$SECRET" --network testnet -- \
      transfer --from "$TREASURY_PK" --to "$CONTRACT_ID" --amount "$MINOR"
    "$0" balance
    ;;
  withdraw)
    [ -z "${2:-}" ] && { echo "usage: $0 withdraw <usdc_amount>" >&2; exit 1; }
    MINOR="$(to_minor "$2")"
    invoke withdraw --to "$TREASURY_PK" --amount "$MINOR"
    "$0" balance
    ;;
  set-amount)
    [ -z "${2:-}" ] && { echo "usage: $0 set-amount <usdc_amount>" >&2; exit 1; }
    MINOR="$(to_minor "$2")"
    invoke set_claim_amount --claim_amount "$MINOR"
    "$0" balance
    ;;
  *)
    grep '^#   ' "$0" | sed 's/^#   //'
    exit 1
    ;;
esac
