# Submitting Treaty to Build Before Q-Day

**Deadline: Wednesday 2 December 2026, 23:59 UTC.** After that, projects are read only. Aim to submit on 1 December.

Category: **Post-Quantum AI Agents** (team of 1 to 4). Every category is scored on: works as described (25%), QoreChain tech usage verified in the repo **and on chain** (25%), post-quantum correctness and security (20%), originality (15%), clarity, UX and documentation (15%). On-chain usage is checked from transactions sent by the `qor1` addresses on your project page, so the live run on Diana matters.

## 1. Registration (5 minutes)

On [build.qorechain.io](https://build.qorechain.io), with **every team member** registered individually:

- [ ] GitHub account connected
- [ ] X account connected
- [ ] QoreX testnet address connected

## 2. Accounts on Diana (about 30 minutes, on your computer)

```sh
git clone https://github.com/drained69/treaty.git && cd treaty
npm ci
npm run accounts -- create
```

This prints five `qor1…` addresses (deployer, owner, research agent, data agent, cleaning agent) and saves their keys in `.env.diana`, which git ignores. Keep that file private and never paste it anywhere.

- [ ] Claim test QOR for **each** of the five addresses at the [faucet](https://dashboard.qorechain.io/faucet) (once per address every 24 hours).
- [ ] `npm run accounts -- status` shows every account funded.
- [ ] `npm run accounts -- register` registers each account's ML-DSA-87 key.

## 3. Deploy and run live (about 20 minutes)

```sh
npm run accounts -- deploy     # deploys Treaty, saves its address
npm run accounts -- windows    # each party's scoped window: only Treaty, capped txs, value and blocks
npm run demo -- --diana        # the agents demo on Diana, about 10 minutes
```

The demo prints an explorer link for every transaction and saves them all to `deployments/diana-demo.json`.

- [ ] Commit and push `deployments/diana-demo.json`: `git add deployments && git commit -m "Live Diana run" && git push`
- [ ] Put the Treaty contract address at the top of the README, replacing "*link added at submission*" with the address and the video link.

### Act two: smart-account spending rules (about 10 minutes, do this one)

The track asks for smart-account spending rules. This run puts them on Diana: Olivia links the research agent's session key to her own account under a QoreChain spending rule, the agent locks a budget straight from her account, the chain refuses what the rule does not allow, and she revokes the key.

```sh
git pull                        # get the smart-account code
npm ci                          # installs @noble/curves, now a direct dependency
npm run accounts -- status      # each account needs QOR; the owner needs about 7 QOR
npm run accounts -- windows     # fresh windows for the agents (the old ones have expired)
npm run demo:session            # act two, about 8 minutes
```

- [ ] Check the run printed `REFUSED` for the three attempts the chain should refuse, and `Done` at the end. If any line says `Unexpected`, send me the output before pushing.
- [ ] Commit and push `deployments/diana-smart-account.json`: `git add deployments && git commit -m "Live smart-account run" && git push`. The live page then shows act two with every transaction.

If a step fails, run `npm run accounts -- status`. Most problems are an account without QOR, an unregistered key, or a window that ran out (open new ones with `npm run accounts -- windows`). Ask in the fest Discord if Diana itself misbehaves.

## 4. The web app (optional, about 10 minutes)

To show the UI live in the video:

```sh
echo "VITE_TREATY_ADDRESS=<the deployed address>" > .env
npm run dev
```

Open the printed URL and the treaty's page: `#agreement/<address>/<treaty number from the demo>`. With the QoreX extension on testnet you can sign there; MetaMask (Diana, chain ID 9800) sends the transactions.

## 5. The video (3 minutes or less)

Record the screen with your voice. Suggested script:

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | The README's featured image | "AI agents are starting to pay each other. Today that means trusting the other agent, or giving a bot a key whose limits live in its own code. And that money is exactly what a quantum computer would steal. Treaty fixes both." |
| 0:20 | `npm run demo -- --diana` starting | "Every party here is a separate agent with its own post-quantum key on QoreChain. Olivia, a human, owns the research agent and sets its limits: ten QOR per deal, fifteen in total. The contract enforces them." |
| 0:45 | Signing and funding | "The agents sign the exact terms with ML-DSA-87. The contract checks every signature on chain with pqcVerify. The budget is locked in the contract, so the data agents know it's there." |
| 1:05 | The refused second treaty | "The agent tries to commit more than Olivia allowed. Refused, by the contract." |
| 1:20 | Deliveries | "Work is delivered; only its hash goes on chain. Good data is accepted and paid, bad data rejected. When the client goes quiet, anyone can release the payment after the review period." |
| 1:45 | The attack lines | "An attacker steals the data agent's wallet key. It tries to withdraw and to deliver junk. Both blocked: every action needs the post-quantum key." |
| 2:05 | Revoke and refund | "Olivia switches her agent off. It can't sign anything any more, and the unused budget goes back to her, not the agent." |
| 2:25 | The treaty page in the web app, or the explorer | "Every agreement and payment also writes a receipt on QoreChain Native through the Cross-VM bridge, verifiable on both VMs. People can sign in the browser with QoreX, and see exactly what they approve." |
| 2:30 | Act two on the live page | "And the chain itself enforces a second layer. Olivia's money stays in her own account; her agent holds only a session key she linked with QoreChain's smart-account module. It can call nothing but Treaty's fund and refund, within caps per call and per day. The chain refuses everything else, and one transaction from Olivia switches it off." |
| 2:50 | The requirements table in the README | "Scoped windows, smart-account spending rules, authenticated messages, all post-quantum. Treaty: binding deals between AI agents, safe after Q-Day." |

- [ ] Upload the video (YouTube unlisted or similar) and keep the link.

## 6. The project page

| Field | What to enter |
| --- | --- |
| Name | Treaty |
| Category | Post-Quantum AI Agents |
| One-line description | Binding deals between AI agents, safe after Q-Day: agents sign terms with ML-DSA-87, the contract holds the money, and owners set limits their agents cannot break. |
| Repository | https://github.com/drained69/treaty (public, MIT) |
| Website / demo | https://treatyv1.vercel.app |
| Featured image | `assets/readme/featured.jpg` (1600×900 copy for link previews: `public/featured.png`) |
| Video | your link |
| Testnet addresses | the Treaty contract, and all five `qor1…` addresses from `npm run accounts -- status` (owner, research, data and cleaning agents, deployer) |
| How it's made | "Solidity contract on Diana using pqcVerify and pqcKeyStatus for every signed action, the Cross-VM bridge for Native receipts, scoped EVM windows per agent, smart-account spending rules (the owner links the agent's session key with QoreChain's abstractaccount module: only Treaty.fund and Treaty.refund, QOR caps per call and per day, revocable), hybrid Native transactions, and QoreSign message signing (QoreX in the browser, the SDK for agents). See README, AUDIT.md and AI_USAGE.md." |
| Kits and features to tick | `@qorechain/sdk`, `@qorechain/evm`, `@qorechain/qoresign`; PQC precompiles (pqcVerify, pqcKeyStatus), EVM windows, agents / smart accounts (authenticators and spending rules), Cross-VM, QoreX message signing. Only tick what the checker can find: all of these are in the code and, after act two, on chain. |
| Country / region | where most of the team lives (for the Regional Award) |
| AI-native option | **tick it**: `AI_USAGE.md` is in the repository (Best AI-Native Build, $500) |

- [ ] Press **Check again** on the project page so the addresses and kits show as Verified.

## 7. Final checklist

- [ ] Public repository with `LICENSE` (MIT), `README.md`, `AI_USAGE.md`
- [ ] Featured image, video of 3 minutes or less
- [x] `deployments/diana-demo.json` pushed; contract address and website in the README
- [ ] Act two run and `deployments/diana-smart-account.json` pushed
- [ ] Video link in the README
- [ ] Every testnet address listed on the project page, and verified
- [ ] Submitted before 2 December 23:59 UTC
- [ ] Post about it on X with **#BuildBeforeQDay** (People's Choice is a community vote, 6 to 15 December)

Useful: the **submission clinic** workshop, Friday 27 November at 16:30 UTC (registration on the fest site), and the fest Discord for questions.
