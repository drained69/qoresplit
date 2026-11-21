# QoreSplit

QoreSplit is a checkout for workshops, creators, and other collaborators who share revenue. One checkout credits separate balances for two or three recipients on QoreChain EVM and records a matching receipt on QoreChain Native. Each recipient withdraws their own balance.

## Run locally

Requires Node.js 22.9 or later. The contract integration tests also require Foundry's `anvil` on PATH.

```sh
npm ci
npm run dev
npm test
npm run build
```

The app opens in preview mode until you configure a Diana deployment. You can edit a split and see the payout calculation in preview mode. Live writes and receipt lookups require a contract address.

## Deploy and use on Diana

1. Prepare a dedicated, [funded Diana account](https://dashboard.qorechain.io/faucet) using the [QoreChain workshop signing flow](https://docs.qorechain.io/build-before-qday/workshop-2/). Register its ML-DSA-87 key and open an EVM window that permits deployment. Contract creation requires a window without an allowed-target list. Keep the private key and recovery code local.
2. Copy `.env.example` to `.env` and set `DIANA_DEPLOYER_KEY` to the dedicated test account's EVM key. Run `npm run deploy`. Set `VITE_QORESPLIT_ADDRESS` to the confirmed address printed by the deploy script. Restart the dev server or rebuild the app. Serve `dist/` using any static host to share links externally.
3. Connect MetaMask or a compatible EVM wallet. Use an Ethereum-style QoreChain test account (coin type 60) with a registered PQ key and an open EVM window. For normal operation permit the deployed QoreSplit address and allow sufficient transaction count, QOR including fees, and expiry. Recipients need their own funded, ready EVM accounts to withdraw. [QoreChain wallet setup](https://docs.qorechain.io/getting-started/wallet-setup/) and [authorization windows](https://docs.qorechain.io/developer-guide/evm-window-reference/) cover this setup.
4. Publish a link for a workshop priced at **12 QOR** with shares of **50%, 30%, and 20%**. Share the checkout URL. Pay from a prepared payer wallet. The receipt shows **6, 3.6, and 2.4 QOR** credited. Open it in a separate browser to verify EVM and Native records without connecting a wallet.
5. Connect one recipient and withdraw their share. The other recipients' credits remain available independently.

## Checkout guarantees

- A link keeps its original title, price, recipient addresses, and shares. A different split requires a different link. Titles and recipient addresses are public.
- A checkout accepts the exact price once per payer, link, and payment reference. The contract rounds down to whole uqor for all but the last recipient, who gets the remainder. The interface previews the exact amounts.
- The checkout credits every share and calls the Diana bridge at `0x0901` with the receipt commitment. A failed bridge call or an empty response reverts the checkout. The transaction fee can still apply to a mined revert.
- Verification recomputes the commitment from the EVM event and immutable link. It reads the Native receipt ID returned during checkout and independently checks the stored receipt's sender, height, and commitment. The UI distinguishes an EVM confirmation from successful verification on both sides.
- Withdrawals can only be made by the recipient to their own address. An unsuccessful withdrawal restores that recipient's credit. There is no operator withdrawal or payout redirection.

The bridge target is the workshop's [governance-approved Native receipt book](https://docs.qorechain.io/build-before-qday/workshop-3/). The app's receipt verifies checkout and accounting. Withdrawal is a separate EVM transaction.

## Verification

`npm test` deploys QoreSplit to a local Anvil node with a bridge test double. It checks exact rounding, receipt commitment, independent withdrawals, repeated payment protection, input validation, and checkout rollback when the bridge rejects or is inactive. The production contract has no failure switch.

Credit to the [QoreChain workshop](https://github.com/qorechain/build-before-qday/tree/main/workshop-3/02-cross-vm) for the reference bridge interface and shared Native receipt contract.
