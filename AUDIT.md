# Treaty Diana release audit

Treaty was called QoreSplit until version 2 and QorePact briefly during version 3.

## Version 4: smart-account spending rules

Scope: `sdk/smart-account.mjs` and `sdk/native.mjs` (sessions on QoreChain's abstractaccount module), the account commands, act two of the demo, the Native route `/api/native/smart-account/<qor1>`, and the statement card. The contract did not change and was not redeployed: it already accepts a budget locked by the client's owner.

| Risk | Resolution |
| --- | --- |
| A stolen session key drains the owner's account. | The key is linked with the `evm` permission only (no `send`, staking, voting or deploy), and the rule's `allowed_evm_calls` lists only `Treaty.fund(uint256)` and `Treaty.refund(uint256)` on this contract. Every call is capped per call and per UTC day in QOR, measured by the chain on the call's real outflow, and the link expires. `fund` succeeds only for treaties the client agent signed with ML-DSA-87 within its mandate, and locked money leaves only per accepted delivery or back to the owner. |
| A relayer alters or replays the agent's call. | The session key signs the v2 `MsgExecuteEVM` digest, which binds the chain, the account, the key, the target, the value, the call data, the key's own nonce and the gas limit. The chain refuses a mismatch, and a refused execution still consumes the nonce. Tests check that changing the gas, value or nonce breaks the signature. |
| Someone links a key to an account they do not own, or a key is linked without consent. | Linking is an owner-signed hybrid transaction (secp256k1 + ML-DSA-87); the session key signs a possession proof bound to the chain and that exact account, which the SDK verifies before sending. |
| A refused execution is read as a success. | From chain v3.2.8 a refused execution is a code-0 transaction with an `abstractaccount_execution_failed` event. The session reads the delivered transaction and reports `success: false` with the chain's reason. |
| The rule is wider than intended. | `MsgUpdateSpendingRules` replaces the account's rules wholesale; the SDK builds one rule with both caps set (the chain refuses a value permission without a bounding rule) and validates it with the SDK's own checks before sending. |
| An account that never linked a key breaks the statement page. | Diana answers 404 for it; the route and the SDK report it as "not a smart account" instead of an error. |

## Version 3.1: private deliveries and QoreX detection

Scope: QoreSeal sealed deliveries (`sdk/seal.mjs`, `deliver --seal`, `open`, `accounts -- seal-keys`), QoreX detection with `@qorechain/qorex-types`, and tests against the official QoreX mock. The contract did not change, so the deployment and the live run on Diana stand.

| Risk | Resolution |
| --- | --- |
| A provider seals one thing and puts the hash of another on chain. | The client's `openDelivery` hashes the plaintext and refuses unless it equals the delivery's hash on chain. |
| An envelope for one delivery is presented as another treaty's or unit's work. | The envelope's authenticated data names the contract, treaty and unit, and QoreSeal binds the chain and the purpose `treaty-delivery`; opening it as anything else fails. |
| Someone other than the client reads the work. | It is sealed to the client's ML-KEM-1024 key (plus X25519 in the hybrid mode). Tested: another party's keys, including the co-provider's, cannot open it. |
| A malformed or substituted seal key. | Keys are checked as the chain checks registered keys (length and the FIPS 203 modulus check) before anything is sealed. A provider should get the key from the client, or from the chain's KEM registry with `sealTo: 'chain'`. |
| The app offers QoreX signing that today's QoreX would refuse. | QoreX signing is offered only to a build that announces message signing; otherwise the app explains why and points to the signing tool. |

Known limits: QoreSeal hides only the payload (sizes and timing stay public), and its construction is pending external review before its 1.0 release. Seal keys from a mnemonic use QoreSeal's standard derivation; from a private key they use `SHAKE-256("treaty:qoreseal:v1|" + key)`, which only Treaty tools reproduce. `accounts -- seal-keys` follows the same broadcast path as the tested key registration but has not yet been run on Diana.

Contract re-review (no change deployed): state is updated before every transfer (refund, withdraw, payouts); every signed message names the chain, contract, treaty and unit or nonce, so none can be replayed; deliveries cannot exceed the unit cap; a switched-off agent cannot sign. One hardening note for a future version: `_requirePqcSignature` does not compare the `algorithmId` that `pqcKeyStatus` returns. It has no effect today, because `pqcVerify` verifies ML-DSA-87 only, so a key of another algorithm fails verification; checking it explicitly would give a clearer error.

## Version 3: service treaties and agent owners

Scope: service treaties (budget, deliveries, review, release, refund), agent mandates (owner limits, switching off, expiry), the SDK, the relayable request format, and the web app's new pages.

| Risk | Resolution |
| --- | --- |
| A provider starts work and the client never pays. | The whole budget is locked before any delivery counts, and a delivery the client neither accepts nor rejects can be released by anyone after the review period. |
| A client is charged for work it rejected, or for more units than agreed. | A rejection within the review period frees the unit without payment. Deliveries stop once paid plus pending units reach the maximum, or at the deadline. |
| Unused budget is stuck, or a refund takes money owed for delivered work. | After the deadline anyone can refund; pending deliveries stay reserved and can still be accepted or released. |
| A forged delivery, acceptance or rejection. | Each is ML-DSA-87 signed over the chain, contract, treaty, unit and work hash, by a listed provider or the client respectively. |
| An agent overspends, or keeps acting after its owner wants it stopped. | The owner's per-treaty and total limits are checked when the agent signs as a client and again when its budget is locked. A revoked or expired agent cannot sign anything; its withdrawals need the owner's signature and its refunds go to the owner. |
| Someone claims an agent, or an agent names an owner who did not agree. | Setting limits needs both the agent's and the owner's ML-DSA-87 signatures, with a per-agent nonce. Only the current owner can change them. |
| A third party locks a client's budget, and the unused part is refunded to the client instead of to them. | Only the client, or the client's owner, can lock a budget, so refunds always go back to whoever's money it was. Found in the 26 November audit. |
| A relayed request could call something unexpected. | The signed request names one of seven post-quantum-signed actions with typed arguments; anything else is refused before a wallet sees it, and the contract checks the signature regardless. |

The local Diana stand-in used by `npm run e2e` and `npm run demo` verifies every ML-DSA-87 signature in these actions with real cryptography before its `pqcVerify` stand-in accepts it.


## Version 2: post-quantum consent and withdrawals (QoreSplit)

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
