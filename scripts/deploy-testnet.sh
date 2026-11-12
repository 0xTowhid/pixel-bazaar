#!/usr/bin/env bash
# Deploy Pixel Bazaar to NEAR testnet from Linux (or WSL).
# Needs (Arch: sudo pacman -S --needed base-devel jq nodejs npm):
#   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && rustup target add wasm32-unknown-unknown
#   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh
#   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh
# A contract update that changes stored data needs a NEW account name (old state cannot be read by new code).
# Usage:  ACCOUNT=pixelbazaar-yourname.testnet ./scripts/deploy-testnet.sh
set -euo pipefail
: "${ACCOUNT:?set ACCOUNT, e.g. ACCOUNT=pixelbazaar-yourname.testnet}"
cd "$(dirname "$0")/../contract"

OPS="ops.$ACCOUNT"
echo "1/5 Building the contract"
cargo near build non-reproducible-wasm

echo "2/5 Creating $ACCOUNT with testnet NEAR from the faucet"
near account create-account sponsor-by-faucet-service "$ACCOUNT" autogenerate-new-keypair save-to-legacy-keychain network-config testnet create

echo "3/5 Creating the operator account $OPS (the server holds only this key, never the contract's)"
near account create-account fund-myself "$OPS" '4 NEAR' autogenerate-new-keypair save-to-legacy-keychain \
  sign-as "$ACCOUNT" network-config testnet sign-with-legacy-keychain send

echo "4/5 Deploying and initialising with $OPS as the operator"
near contract deploy "$ACCOUNT" use-file target/near/contract.wasm \
  with-init-call new json-args "{\"operator\":\"$OPS\"}" prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-legacy-keychain send

echo "5/5 Creating the NPC accounts rita.$ACCOUNT and kaito.$ACCOUNT"
near contract call-function as-transaction "$ACCOUNT" create_npc json-args '{"name":"rita"}' \
  prepaid-gas '50.0 Tgas' attached-deposit '0.1 NEAR' sign-as "$OPS" network-config testnet sign-with-legacy-keychain send
near contract call-function as-transaction "$ACCOUNT" create_npc json-args '{"name":"kaito"}' \
  prepaid-gas '50.0 Tgas' attached-deposit '0.1 NEAR' sign-as "$OPS" network-config testnet sign-with-legacy-keychain send

KEYFILE="$HOME/.near-credentials/testnet/$OPS.json"
echo
echo "Done. Start the game server with:"
echo "  CONTRACT_ID=$ACCOUNT OPERATOR_ID=$OPS OPERATOR_KEY=\$(jq -r .private_key $KEYFILE) GAME_SECRET=\$(openssl rand -hex 32) node server/index.mjs"
echo "Keep GAME_SECRET the same between restarts. (If it ever changes, open days are cancelled and refunded automatically.)"
echo "Keep the contract key ($HOME/.near-credentials/testnet/$ACCOUNT.json) OFF the server: it can redeploy or delete the game."
