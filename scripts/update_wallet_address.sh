#!/bin/bash

# Script to update a user's wallet address in the database
# Usage: ./update_wallet_address.sh <username> <new_public_key> [network]

USERNAME=$1
NEW_PUBLIC_KEY=$2
NETWORK=${3:-testnet}

if [ -z "$USERNAME" ] || [ -z "$NEW_PUBLIC_KEY" ]; then
  echo "Usage: ./update_wallet_address.sh <username> <new_public_key> [network]"
  echo "Example: ./update_wallet_address.sh alice GBPRNUORGHO6JCROZC2N4MSAX7UANTWP7U37FQP6RR2AR4Q73SK7VK3Z testnet"
  exit 1
fi

echo "Updating wallet address for user: $USERNAME"
echo "New public key: $NEW_PUBLIC_KEY"
echo "Network: $NETWORK"
echo ""

curl -X POST http://localhost:3001/api/wallet/update-address \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"newPublicKey\": \"$NEW_PUBLIC_KEY\",
    \"network\": \"$NETWORK\"
  }" | jq '.'

echo ""
echo "Done!"
