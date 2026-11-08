#!/usr/bin/env bash
# Deploy Pixel Bazaar to NEAR testnet from Linux (or WSL).
# Needs: rustup, cargo-near and near-cli-rs (install commands are in README.md).
# Usage:  ACCOUNT=pixelbazaar-yourname.testnet ./scripts/deploy-testnet.sh
set -euo pipefail
: "${ACCOUNT:?set ACCOUNT, e.g. ACCOUNT=pixelbazaar-yourname.testnet}"
cd "$(dirname "$0")/../contract"

echo "1/4 Building the contract"
cargo near build non-reproducible-wasm

echo "2/4 Creating $ACCOUNT with testnet NEAR from the faucet"
near account create-account sponsor-by-faucet-service "$ACCOUNT" autogenerate-new-keypair save-to-legacy-keychain network-config testnet create

echo "3/4 Deploying and initialising (the contract account is also the operator)"
near contract deploy "$ACCOUNT" use-file target/near/contract.wasm \
  with-init-call new json-args "{\"operator\":\"$ACCOUNT\"}" prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-legacy-keychain send

echo "4/4 Creating Rita's on-chain account (rita.$ACCOUNT)"
near contract call-function as-transaction "$ACCOUNT" create_npc json-args '{"name":"rita"}' \
  prepaid-gas '50.0 Tgas' attached-deposit '0.1 NEAR' sign-as "$ACCOUNT" network-config testnet sign-with-legacy-keychain send

KEYFILE="$HOME/.near-credentials/testnet/$ACCOUNT.json"
echo
echo "Done. Start the game server with:"
echo "  CONTRACT_ID=$ACCOUNT OPERATOR_ID=$ACCOUNT OPERATOR_KEY=\$(jq -r .private_key $KEYFILE) GAME_SECRET=\$(openssl rand -hex 32) node server/index.mjs"
echo "Keep GAME_SECRET the same between restarts, or days already in progress cannot be revealed."
