# How AI was used to build Treaty

Treaty was built during Build Before Q-Day with **Claude Code** (Anthropic), an AI coding agent, working in a cloud development session on this repository. This file records the workflow, what the AI generated, how its work was checked, and what the human contributed.

## The workflow

The project was built in a conversation between the developer and the agent, in rounds. Each round followed the same loop:

1. **The developer set the direction** in plain language: "explain what my product does", "I don't think it's good enough to win, improve the idea", "make it about agents, not just selling", "audit that everything works", "read the hackathon rules and guide me".
2. **The agent researched before building.** It read the official QoreChain workshop code (the `pqcVerify` vault, the window script, the bill-paying agent, the Cross-VM checkout), the SDK's type definitions, the QoreSign package, and the fest's rules, prizes and FAQ. It also read the fest's public live feed to see what kinds of projects other teams were building.
3. **The agent proposed a plan with trade-offs**, and the developer chose. Examples: pivoting from a split-payment checkout to agreements between agents; adding owner limits; the name (QoreSplit → QorePact → Treaty); entering Post-Quantum AI Agents.
4. **The agent implemented, then verified its own work** by running tests, an end-to-end suite, read-only checks on the live Diana testnet, and screenshots of the web app at desktop and phone widths, and fixed what it found.
5. **The agent committed each verified step** with a descriptive message, so the history shows how the project evolved.

## What the AI generated

Nearly all of the code and documentation in this repository:

| Area | Files |
| --- | --- |
| Smart contract | `contracts/Treaty.sol`: consent with ML-DSA-87, revenue shares and amendments, service treaties (budget, deliveries, review, release, refund), owner mandates, QoreSign-format messages, Cross-VM receipts |
| Protocol and SDK | `src/protocol.js`, `sdk/treaty.mjs`, `sdk/pqc.mjs`: byte-exact message builders, the agent SDK, ML-DSA-87 signing |
| Tools | `scripts/treaty.mjs` (signing tool), `scripts/accounts.mjs` (Diana accounts and scoped windows), `scripts/deploy.mjs`, `scripts/check-diana.mjs` |
| Web app | `src/app.js`, `src/chain.js`, `src/qorex.js`, `src/style.css`, `index.html`, `server/native.mjs` |
| Demo | `examples/agents-demo.mjs`: research, data and cleaning agents and their owner |
| Test infrastructure | `test/treaty.test.mjs`, `test/e2e.test.mjs`, `scripts/local-diana.mjs`: a local Diana stand-in whose `pqcVerify` only accepts signatures verified with real ML-DSA-87, and a stand-in QoreX wallet that signs with the official QoreSign library |
| Docs | `README.md`, `AUDIT.md`, this file |

## How the AI's work was checked

The agent was not trusted on its word. Every claim in the README is backed by something that runs:

- **Unit tests** (`npm test`): the contract's rules, and that the contract's message bytes equal the SDK's for every kind of signature.
- **End-to-end tests** (`npm run e2e`): the real deploy script, signing tool and web app in a real browser, against a chain where forged signatures fail as they would on Diana.
- **Live checks on Diana** (`npm run check:diana`): read-only calls to the real testnet. These caught real issues the local tests could not: Diana's RPC caps gas estimates at 5M, state overrides switch off QoreChain's precompiles, and a contract-creation call needs a sender whose window allows creation. The tooling was changed to match.
- **An audit round** in which the agent re-read the contract and found a real bug: anyone could lock a client's budget, but refunds went to the client, so a third party could lose money. It was fixed with tests before submission (see `AUDIT.md`).
- **Visual checks**: screenshots of every page at desktop and phone width, which caught layout bugs (long addresses overflowing on phones).

## What the human contributed

- The original idea, every product decision, and the choice of category and name.
- Reviewing the plans and results the agent reported, and deciding what to build next.
- Everything that needs a person: registering for the fest, creating and funding the Diana accounts, holding the keys (they never entered the AI session), deploying and running the live demo on Diana, recording the video, and submitting.

## Where AI was not used

No keys, recovery phrases or funds were ever shared with the AI. The live testnet transactions are signed on the developer's own computer.
