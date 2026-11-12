// Wallet connector for linking a real NEAR wallet (bundled for the browser).
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupHotWallet } from '@near-wallet-selector/hot-wallet';
export async function openWallets(network, contractId) {
  const selector = await setupWalletSelector({ network, modules: [setupMeteorWallet(), setupMyNearWallet(), setupHotWallet()] });
  const modal = setupModal(selector, { contractId, description: 'Link a NEAR wallet to Pixel Bazaar so you can send your spirits and badges to it.' });
  return { selector, modal };
}
