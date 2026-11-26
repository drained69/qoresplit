# Treaty

**Post-quantum agreements between people and AI agents. Nobody holds the money.**

Treaty lets any parties — people, AI agents, or both — agree on terms, sign them with post-quantum keys, and have a contract on QoreChain hold the money and pay it out exactly as agreed.

- **Every party signs the exact terms** with its **ML-DSA-87** key. The contract checks each signature on chain with QoreChain's `pqcVerify` precompile, against the key the chain's own registry holds for that account (`pqcKeyStatus`). Nobody can be committed, paid or added without signing.
- **The contract holds the money.** Every payment writes a receipt on QoreChain Native in the same transaction, so anyone can verify it on both VMs.
- **A stolen wallet key gets nothing.** Every action that moves money or commits a party — accepting terms, delivering work, reviewing it, withdrawing — needs an ML-DSA-87 signature. A stolen or quantum-broken secp256k1 key alone cannot do any of it. Anyone may relay a signed action, so agents and people can use any wallet to send it.
- **Owners keep their agents on a leash.** An agent can have a human owner with limits the contract enforces: the largest budget per treaty, the total it may commit, and an expiry. The owner can switch the agent off; from then on only the owner can move the agent's money, and unused budgets go back to the owner.

## Two kinds of treaty

| | Revenue share | Service treaty |
| --- | --- | --- |
| For | Selling something together | Hiring someone, or some agent, for work |
| Who signs | Every party | The client and every provider |
| Money in | Anyone pays a fixed price | The client locks a budget: price per unit × units |
| Money out | Each payment is split by shares | Each accepted unit is paid, split between the providers |
| If someone goes quiet | — | A delivery the client neither accepts nor rejects pays itself after the review period |
| At the end | — | After the deadline, unused budget returns to the client (or its owner) |
| Changes | A new version every old and new party signs | Agree a new treaty |

## Why QoreChain

AI agents are starting to pay each other, and revenue shares and budgets build up over months — exactly the money a future quantum attacker would target. On QoreChain every account already registers an ML-DSA-87 key, and EVM contracts can verify it on chain. Treaty uses that key for everything that matters, keeps every agreement and payment atomic across the EVM and QoreChain Native through the governance-pinned Cross-VM bridge, and turns the chain's post-quantum keys into identities that agents can sign with directly: an agent runs as code, so it signs with the SDK, no browser wallet needed.

## See it in 30 seconds

```sh
npm ci
npm run demo
```

A research agent, on a budget from its human owner, hires a data agent and a cleaning agent (80/20) to clean five datasets at 2 QOR each. The demo runs on a local Diana stand-in where every party has its own real ML-DSA-87 key:

1. The owner sets limits: 10 QOR per treaty, 15 QOR in total, 7 days. The agent tries to commit to a second treaty: refused.
2. All three agents sign the terms; the research agent locks 10 QOR.
3. A good dataset is accepted and paid; a bad one is rejected; a fixed one that the client ignores is released after the review period.
4. An attacker with the data agent's stolen wallet key tries to withdraw and to deliver junk: both blocked.
5. The owner switches the research agent off. The deadline passes: the unused 4 QOR goes back to the owner, not the agent.
6. The team withdraws with their post-quantum keys.

`npm run demo -- --serve` keeps the chain running and opens the web app on the result.

## Run locally

Requires Node.js 22.9 or later.

```sh
npm ci
npm run dev
npm test
npm run build
```

The app opens in preview mode until you configure a Diana deployment.

## For agents: the SDK

```js
import { Treaty } from './sdk/treaty.mjs';

const agent = await Treaty.connect({ contract, mnemonic });           // or privateKey + recoveryCode
const id = await agent.proposeService({
  title: 'Clean five survey datasets', unitPrice: '2', maxUnits: 5,
  deadline, reviewPeriod: 600, client: agent.address,
  providers: [dataAgent, cleaningAgent], shares: [8000, 2000],
});
await agent.sign(id);                       // checks the terms, signs them with ML-DSA-87
await agent.fund(id);                       // locks the budget
// a provider: await provider.deliver(id, workBytes)
await agent.accept(id, 0);                  // or reject(id, unit); anyone can release(id, unit) later
await provider.withdraw('all');
```

Every signed action rebuilds the exact bytes from the on-chain terms and refuses to sign if the contract would check anything else. It checks the local key against the chain's registry and the account's EVM window before sending. Pass `{ relay: true }` to get a signed request that any wallet can submit instead. For owners: `agent.approveOwner(limits)` returns the agent's consent, `owner.setMandate({ agent, ...limits, agentSignature })` sets the limits, and `owner.revoke(agent)` switches it off.

## For people: the signing tool

Browser wallets cannot make ML-DSA-87 signatures over arbitrary bytes yet: QoreX refuses `signArbitrary`, and MetaMask has no ML-DSA. People sign with the same SDK from the command line, with their keys in `.env` (`QORE_MNEMONIC`, or `PRIVATE_KEY` with `QORE_PQC_RECOVERY_CODE`):

| Command | What it does |
| --- | --- |
| `npm run pq -- whoami` | Your addresses, and whether your local ML-DSA-87 key matches the chain |
| `npm run pq -- show <id>` | A treaty's terms, signatures and deliveries |
| `npm run pq -- sign <id>` | Accept a treaty's terms |
| `npm run pq -- fund <id>` | Lock a service treaty's budget |
| `npm run pq -- deliver <id> --file f` | Deliver one unit; only its hash goes on chain |
| `npm run pq -- accept <id> <unit>` / `reject` | Review a delivery as the client |
| `npm run pq -- release <id> <unit>` / `refund <id>` | Pay an ignored delivery; return unused budget after the deadline |
| `npm run pq -- withdraw <QOR\|all> [--to 0x…] [--for 0x…]` | Pay out earnings (`--for`: an agent you own and switched off) |
| `npm run pq -- statement [0x…]` | Earnings, withdrawals, treaties and owner limits of an address |
| `npm run pq -- approve-owner …` / `set-limits …` / `revoke <agent>` | Put an agent under an owner's limits, or switch it off |
| `npm run pq -- attack [QOR]` | Demo: your classical key alone tries to withdraw. Simulated; nothing is sent |

`--out file.json` saves a signed request instead of sending it; paste it into *Submit a signature* in the app and any connected wallet can send it. `--yes` skips the confirmation.

## Deploy and use on Diana

1. **Prepare accounts.** Each party and the deployer needs a funded Diana account with a registered, proven ML-DSA-87 key. Follow the [QoreChain workshop signing flow](https://docs.qorechain.io/build-before-qday/workshop-2/) and the [faucet](https://dashboard.qorechain.io/faucet). Keep private keys and recovery codes on your own computer.
2. **Deploy.** Copy `.env.example` to `.env`, set `DIANA_DEPLOYER_KEY`, open an EVM window that allows contract creation, and run `npm run deploy`. The script checks the bridge allowlist, the window, and that `pqcKeyStatus` returns the deployer's proven key. Set `VITE_TREATY_ADDRESS` to the printed address and rebuild. The build also emits a standalone Worker at `dist/server/index.js` that serves the app and the two Diana Native reads; on other hosts, route `/api/native/` to the same handler, because Diana Native REST does not allow browser cross-origin requests.
3. **Windows.** Every account that sends a transaction needs an EVM window that allows the Treaty contract, enough transactions, and enough value for any payment. Windows can be limited to specific contracts; the app, the tool and the SDK name the rule that would refuse a transaction before anything is signed or sent.
4. **Use it.** Propose a revenue share or a service treaty in the app, share the treaty page, and let every party sign with the tool or the SDK.

## Guarantees

- A treaty's terms never change. A revenue share changes only through a new version that every old and new party signs; the old version then stops taking payments and keeps its history.
- Each signature covers the chain ID, the contract and exactly what it authorises: the terms hash, the delivered work's hash and its unit number, the reviewed delivery, the withdrawal's destination, amount and nonce, or the owner's limits and nonce. None can be replayed elsewhere.
- Signer keys are read from the chain's registry at the moment of signing and must have a proof of possession.
- A service budget is locked in full, by the client or its owner, before any work counts. Pending deliveries stay reserved after the deadline; only the rest is refundable. Shares round down to whole uqor except the last, which gets the remainder.
- An agent with an owner cannot agree to, or be funded for, a treaty beyond its limits. Once switched off or expired, it cannot sign anything; withdrawals of its earnings then need the owner's signature, and its refunds go to the owner.
- Activation and every payment call the Diana bridge at `0x0901`. A failed bridge call or an empty receipt reverts the whole transaction. The transaction fee can still apply to a mined revert.
- There is no contract owner, operator withdrawal, pause, or upgrade.

The bridge target is the workshop's [governance-approved Native receipt book](https://docs.qorechain.io/build-before-qday/workshop-3/). Credit to the [QoreChain workshops](https://github.com/qorechain/build-before-qday) for the bridge interface, the shared receipt contract, and the `pqcVerify` vault and spend-capped agent patterns.

## Verification

| Command | What it proves | Needs |
| --- | --- | --- |
| `npm test` | The contract's rules on an in-process EVM with stand-ins for the bridge and the post-quantum precompiles: consent before payment, signature binding, keys, amendments, cancellation, the stolen-key attack, relayed withdrawals and replay, rounding, receipts, Native rollback, invalid terms; service budgets, deliveries, acceptance, rejection windows, release, unit caps, deadlines and refunds; owner limits, owner changes, raising limits, switching off, expiry, and owner-only withdrawals. One test signs the contract's exact bytes with real ML-DSA-87 keys. | Nothing |
| `npm run e2e` | The whole product on a local Diana stand-in (chain ID 9800) whose `pqcVerify` accepts a signature only after real ML-DSA-87 verification. It runs the real deploy script and signing tool as separate processes with fresh real keys, covers revenue shares, service treaties and agent limits end to end, drives the web app in a real browser (proposing both kinds, relaying signatures, paying, funding, releasing, refunding, verifying receipts on both VMs, statements, amendments, phone layouts), and runs the agents demo. | Playwright for the browser part (`npm i -D playwright && npx playwright install chromium`); without it that part is skipped |
| `npm run check:diana` | Diana itself, read-only: `pqcVerify` accepts real ML-DSA-87 signatures over Treaty's exact bytes and refuses tampered ones; Treaty deploys inside a call and its sign path reaches the real key registry and verifier; the bridge writes to the pinned receipt book and replies as the contract expects; Native REST returns receipts and windows as the app expects. | Network access to Diana. No keys, no funds |

On a network that requires an HTTPS proxy, run the Node scripts with `NODE_USE_ENV_PROXY=1` (Node 22.21 or later) so `fetch` uses it.

None of these can mine a real treaty on Diana without funded accounts. Before a live demo, rehearse once with real accounts: deploy, sign, fund, deliver, accept, withdraw. See [AUDIT.md](AUDIT.md) for the release review.
