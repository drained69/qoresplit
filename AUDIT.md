# QoreSplit Diana release audit

## Version 2: post-quantum consent and withdrawals

Scope: agreement proposals, ML-DSA-87 consent, amendments, post-quantum withdrawals, the signing tool, and the relay form.

| Risk | Resolution |
| --- | --- |
| An organizer could list anyone as a recipient at any share. | A link takes payments only after every recipient signs the exact terms with the ML-DSA-87 key registered for their account. |
| A split change could drop or dilute a collaborator. | A new version also needs every recipient of the version it replaces. It activates only while that version is still active, so a competing amendment goes stale. |
| A stolen or quantum-broken secp256k1 key could withdraw earnings. | Withdrawals require an ML-DSA-87 signature over the recipient, destination, amount and nonce. There is no classical-key withdrawal path. |
| A signature could be replayed on another agreement, deployment, chain or withdrawal. | Signed bytes include the chain ID, the contract and the agreement number or nonce. A nonce increases with each withdrawal. |
| A key registered without proof of possession, or no key at all. | `pqcKeyStatus` must report a registered key with a proof of possession at signing time. |
| The signing tool could sign bytes that differ from the terms it shows. | The tool recomputes the terms hash and the message from the displayed terms and refuses if the contract asks for anything else. It also refuses when the local key differs from the registered one. |
| A pasted signed request could target another chain or deployment. | The app checks the chain ID and contract before relaying; the contract checks the signature regardless of who sends it. |
| Pending proposals could clutter a collaborator's statement. | Statements list only agreements that went live. |

The contract tests run on stand-ins for `pqcVerify` and `pqcKeyStatus`, because no local EVM has QoreChain's precompiles. `npm run e2e` closes most of that gap: its stand-in accepts a signature only after verifying it with real ML-DSA-87, and it drives the real deploy script, signing tool and web app.

Live read-only checks on Diana (`npm run check:diana`, last run 25 November 2026) confirmed:

- `pqcVerify` accepts deterministic and hedged ML-DSA-87 signatures from `@qorechain/sdk` over QoreSplit's exact terms and withdrawal bytes, and refuses a changed message. One verification costs about 315,000 gas including calldata.
- `pqcKeyStatus` returns a registered account's 2592-byte key with its proof-of-possession flag, in the ABI the contract decodes.
- QoreSplit deploys inside a call. Its `sign` reaches the real registry and verifier: `BadPqcSignature` for a junk signature from a registered account, `PqcKeyNotRegistered` for an account without a key.
- The bridge writes QoreSplit's note to the pinned receipt book (code 865) and returns ABI-wrapped JSON longer than 64 bytes. Native REST returns receipts with `id`, `sender`, `note` and `height`, and EVM windows with `live`, `allowed_targets` and remaining limits.

Windows on Diana can be limited to specific contracts, transaction counts and value. The app and the signing tool now name the rule that would refuse a transaction before anything is signed or sent. A mined end-to-end run with funded Diana accounts remains a release check.

`npm audit --omit=dev` reports zero advisories. Hardhat 2, used only to run the tests, carries advisories in its own development dependencies; it is not part of the app, the Worker or the signing tool.

## Version 1

Scope: the contract, deployment preflight, browser wallet flow, checkout links and receipts, withdrawals, browser-to-Native connectivity, and locked dependencies. The target is QoreChain Diana, chain ID 9800.

| Finding | Resolution |
| --- | --- |
| Diana Native REST lacks browser CORS headers. A checkout could confirm on EVM while the hosted app could not read the matching Native receipt. | Added two same-origin, read-only routes with fixed Diana upstreams, bounded inputs, and timeouts. |
| Share links depended on the configured deployment's numeric IDs. Reconfiguring the host could point an old link at a different checkout. | URLs include the expected contract address. The client checks the Diana chain ID and matches deployed bytecode against the build artifact before reading or signing. |
| Transaction confirmation alone did not establish that a replacement or recovered transaction completed the intended checkout. | The app saves the expected payment ID with a pending hash and requires a matching checkout event before showing its receipt. |
| The bridge accepted an ABI-wrapped empty reply as evidence of a receipt. | The contract rejects responses too short to contain the pinned Native receipt format. |
| Browsers with QoreX and MetaMask can expose multiple providers. | Discover EIP-6963 providers and prefer MetaMask for EVM writes. QoreX can open the Diana authorization window. |
| The original compiler dependency pulled in npm-advised versions of the `tmp` module. | Updated the pinned compiler and patched `tmp` dependency. The resulting npm audit had zero reported advisories. |

Payout amounts are computed on chain in whole uqor. The last recipient receives the rounding remainder. Only a recipient can withdraw their credits. Credits are zeroed before the transfer, and a failed transfer restores them through the transaction revert.

The browser independently checks the committed EVM event, its payout amounts and digest, and the Native receipt's sender, note and block height. If the Native read is unavailable or does not match, the browser marks that side unverified.

Local integration tests exercise checkout and withdrawal, including an unsuccessful Native receipt write. Version 2 replaces `withdraw()` with the post-quantum withdrawal above. The live Diana check uses read-only simulation and public queries. A mined deployment and a mined end-to-end checkout still require a funded Diana signer and are a separate release check.
