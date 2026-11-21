# QoreSplit Diana release audit

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

Local integration tests exercise checkout and withdrawal, including an unsuccessful Native receipt write. The live Diana check uses read-only simulation and public queries. A mined deployment and a mined end-to-end checkout still require a funded Diana signer and are a separate release check.
