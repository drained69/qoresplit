# QoreSplit

**Sell together without trusting whoever holds the account, and keep your earnings safe even if your wallet key is broken.**

QoreSplit is a checkout for workshops, creators and other collaborators who share revenue on QoreChain. Nobody holds the money and nobody can change the deal alone:

1. **Everyone signs the terms.** A proposal names the price, the collaborators and their shares. The checkout stays closed until every collaborator accepts those exact terms with their **ML-DSA-87** post-quantum key. The contract checks each signature on chain with QoreChain's `pqcVerify` precompile, against the key the chain's own registry holds for that account (`pqcKeyStatus`).
2. **Each sale pays every share.** One payment credits every collaborator and writes a matching receipt on QoreChain Native in the same transaction.
3. **Earnings leave only with a post-quantum signature.** A withdrawal names the amount and the destination, and the recipient signs it with ML-DSA-87. Anyone may submit it. A stolen or quantum-broken secp256k1 key alone cannot sign terms or move earnings.
4. **Changes need everyone.** A new version must be signed by everyone on it *and* everyone on the version it replaces. Nobody can be dropped or diluted without signing. The old version then stops taking payments and keeps its history.
5. **Anyone can check the books.** Each collaborator has a public statement: earnings per agreement, withdrawals, and a check that the balances reconcile. Receipts verify on EVM and Native without a wallet.

## Why QoreChain

Revenue shares build up over months or years, which is exactly the money a future quantum attacker would target. On QoreChain every account already registers an ML-DSA-87 key, and EVM contracts can verify it on chain. QoreSplit uses that key for the two things that matter: consent to the split, and moving the money. It also keeps every agreement and sale atomic across the EVM and QoreChain Native through the governance-pinned Cross-VM bridge.

## Run locally

Requires Node.js 22.9 or later.

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm test` runs the contract on an in-process EVM (Hardhat, a dev-only dependency), so it needs no Foundry and no network. The app opens in preview mode until you configure a Diana deployment.

## Deploy and use on Diana

1. **Prepare accounts.** Each collaborator and the deployer needs a funded Diana account with a registered, proven ML-DSA-87 key. Follow the [QoreChain workshop signing flow](https://docs.qorechain.io/build-before-qday/workshop-2/) and the [faucet](https://dashboard.qorechain.io/faucet). Keep private keys and recovery codes on your own computer.
2. **Deploy.** Copy `.env.example` to `.env`, set `DIANA_DEPLOYER_KEY`, open an EVM window that allows contract creation, and run `npm run deploy`. The script checks the bridge allowlist, the window, and that the `pqcKeyStatus` precompile returns the deployer's proven key. Set `VITE_QORESPLIT_ADDRESS` to the printed address and rebuild. The build also emits a standalone Worker at `dist/server/index.js` that serves the app and the two Diana Native reads. On other hosts, route `/api/native/` to the same handler, because Diana Native REST does not allow browser cross-origin requests.
3. **Propose.** Connect MetaMask, open *Agreements*, and propose, for example, a workshop at **12 QOR** split **50 / 30 / 20**. Share the agreement page with the collaborators.
4. **Sign.** Each collaborator runs, on their own computer, with their keys in `.env`:

   ```sh
   npm run pq -- sign 1
   ```

   The tool prints the terms, rebuilds the signed bytes from them, checks they match the contract, checks the local key matches the one registered on chain, then asks for confirmation and sends the signature. The last signature opens the checkout and writes the terms' receipt on Native.
5. **Sell.** Share the payment link. The receipt shows **6, 3.6 and 2.4 QOR** credited and verifies on EVM and Native in any browser.
6. **Withdraw.**

   ```sh
   npm run pq -- withdraw all
   ```

   Add `--to 0x…` to pay out to another address.

### The signing tool

Browser wallets cannot make ML-DSA-87 signatures over arbitrary bytes yet: QoreX refuses `signArbitrary`, and MetaMask has no ML-DSA. The signing tool uses the official `@qorechain/sdk` on your computer instead, the same way the QoreChain workshop vault does. It reads `QORE_MNEMONIC` (and `QORE_ACCOUNT_INDEX`), or `PRIVATE_KEY` with `QORE_PQC_RECOVERY_CODE`.

| Command | What it does |
| --- | --- |
| `npm run pq -- whoami` | Your addresses, and whether your local ML-DSA-87 key matches the chain |
| `npm run pq -- show <id>` | An agreement's terms and who has signed |
| `npm run pq -- sign <id>` | Accept agreement `<id>` |
| `npm run pq -- withdraw <QOR\|all> [--to 0x…]` | Pay out earnings |
| `npm run pq -- statement [0x…]` | Earnings, withdrawals and agreements of an address |
| `npm run pq -- attack [QOR]` | Demo: your classical key alone tries to withdraw with a forged post-quantum signature. Simulated; nothing is sent |

By default the tool sends the transaction from the same account, which needs an open EVM window that allows the QoreSplit contract (windows can be limited to specific contracts, a number of transactions, and a value). The tool and the app explain which rule would refuse a transaction before anything is signed or sent. `--out file.json` saves a signed request instead. Paste it into *Submit a signature* in the app, and any connected wallet can send it: the contract only cares about the ML-DSA-87 signature. `--yes` skips the confirmation.

## Demo script (3 minutes)

1. Propose a three-way split. Two collaborators sign. Try to pay: **refused**, the agreement is not live.
2. The third collaborator signs. The checkout opens and the terms' receipt appears on Native.
3. Pay 12 QOR. Shares are credited and the receipt verifies on both VMs.
4. *Propose a change* that drops a collaborator. Everyone else signs: still **pending**, because the dropped collaborator has not.
5. `npm run pq -- attack`: an attacker with the classical key tries to withdraw. **Blocked** by `BadPqcSignature`. Then `npm run pq -- withdraw all` pays out.
6. Open the collaborator's statement in a private window: the balances reconcile, without a wallet.

## Guarantees

- An agreement's title, price, collaborators and shares never change. A different split is a new version that every old and new collaborator signs.
- A terms signature covers the chain ID, the contract, the agreement number, the signer and the terms hash. A withdrawal signature covers the chain ID, the contract, the recipient, the destination, the amount and a per-recipient nonce, so it works once.
- Signer keys are read from the chain's registry at the moment of signing, and must have a proof of possession. A key rotated on chain is picked up automatically.
- A checkout accepts the exact price once per payer, agreement and payment reference. Shares round down to whole uqor except the last, which gets the remainder.
- Activation and every checkout call the Diana bridge at `0x0901`. A failed bridge call or an empty receipt reverts the whole transaction. The transaction fee can still apply to a mined revert.
- Verification recomputes the commitments from contract state and the EVM event. It reads the Native receipt the bridge reported and checks its sender, note and block height. The UI distinguishes an EVM confirmation from verification on both sides.
- There is no owner, operator withdrawal, pause, or upgrade.

The bridge target is the workshop's [governance-approved Native receipt book](https://docs.qorechain.io/build-before-qday/workshop-3/). Credit to the [QoreChain workshops](https://github.com/qorechain/build-before-qday) for the bridge interface, the shared receipt contract, and the `pqcVerify` vault pattern.

## Verification

Three levels, from fastest to closest to the real chain:

| Command | What it proves | Needs |
| --- | --- | --- |
| `npm test` | Contract rules on an in-process EVM, with stand-ins for the bridge and the two post-quantum precompiles: consent before payment, signature binding, unregistered and unproven keys, amendments that need every old and new collaborator, stale competing amendments, cancellation, the stolen-key attack, relayed withdrawals and replay, rounding, receipt commitments, Native rollback, and invalid terms. One test signs the contract's exact bytes with real ML-DSA-87 keys. | Nothing |
| `npm run e2e` | The whole product, end to end, on a local Diana stand-in (chain ID 9800). It runs the real deploy script and the real signing tool as separate processes with real ML-DSA-87 keys from fresh mnemonics. The stand-in verifies every signature with real ML-DSA-87 before its `pqcVerify` accepts it, so forged signatures fail as they would on Diana, and it keeps a receipt book with Diana's reply and REST formats. A real browser then proposes, relays signatures, pays, checks that receipts verify on both VMs, withdraws, follows a replaced link, proposes a change, and checks phone layouts. | Playwright for the browser part (`npm i -D playwright && npx playwright install chromium`); without it that part is skipped |
| `npm run check:diana` | Diana itself, read-only: `pqcVerify` accepts real ML-DSA-87 signatures over QoreSplit's exact terms and withdrawal bytes and refuses tampered ones; QoreSplit deploys inside a call and its sign path reaches the real key registry and verifier; the bridge writes to the pinned receipt book and replies in the format the contract parses; Native REST returns receipts and windows as the app expects. | Network access to Diana. No keys, no funds |

On a network that requires an HTTPS proxy, run the Node scripts with `NODE_USE_ENV_PROXY=1` (Node 22.21 or later) so `fetch` uses it.

What none of them can do without funded accounts is mine a real agreement on Diana. Before a live demo, rehearse once with the collaborators' real accounts: deploy, sign, pay, withdraw. See [AUDIT.md](AUDIT.md) for the release review.
