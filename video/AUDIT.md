# Video audit

Every step checked against the repository (README.md, SUBMISSION.md, AUDIT.md, src/, contracts/Treaty.sol,
examples/agents-demo.mjs) and the live run (deployments/diana-demo.json, deployments/diana.json, the site
screenshots in assets/readme/). "Fixed" items are changed in the current render.

## Step by step

| Time | Step | What it claims | Checked against | Result |
| --- | --- | --- | --- | --- |
| 0:00 | Cover | Tagline, Treaty #1 card (client, 80/20 providers, 2 QOR × 5, 10 QOR budget, limits 10/15/7 days), three ML-DSA-87 seals, "3 paid · 4 QOR refunded", "18 live transactions · 0 failed" | story.js hero, diana-demo.json (18 steps) | Correct |
| 0:04 | The problem | Paying agents trust each other, a middleman, or a bot key whose limits live in its code | README "The problem" (same wording) | Correct. **Fixed:** voiceover line 3 needed 3.4 words/s; retimed to 2.4 |
| 0:13 | Q-Day | secp256k1 keys are what a quantum computer is expected to break; idle budgets are the target | README "The problem" | Correct |
| 0:20 | 01 Limits | 10 QOR per treaty, 15 in total, 7 days; both the agent and Olivia sign | agents-demo.mjs step 1, README live table #1, AUDIT.md (both signatures required) | Correct. Expiry time "7:55 PM" is start of run + 7 days, to the minute |
| 0:45 | 02 Proposal | "Clean five survey datasets", 2 QOR each, up to 5, 9-minute deadline, 60 s review | agents-demo.mjs (Diana: deadlineIn 9 min, review 60 s) | Correct. **Fixed:** caption was on screen 3.3 s for 22 words; now 5.5 s with shorter copy, signing starts 1.8 s later |
| 0:50 | 03 Signatures | Data agent, cleaning agent, research agent sign in that order; pqcVerify checks each; last one activates and records terms on Native (#41) | agents-demo.mjs loop order, README #2–#4, terms receipt from the site | Correct |
| 0:58 | 04 Budget | 10 QOR locked by the client | README #5, app copy "Live · budget locked" | Correct |
| 1:05 | 04 Refusal | A second 10 QOR treaty ("Label 5,000 images", 1 QOR × 10) would take the total to 20 > 15: MandateLimitExceeded; the data agent had signed it | agents-demo.mjs, README #6, tx 0x3ff24c… | Correct. Its number "#2" is inferred (the next ID after #1 on a fresh deployment), not read from chain |
| 1:20 | 05 Deliveries | Only the work hash on chain; dataset 1 accepted 1.6 + 0.4 QOR (receipt #42); dataset 2 rejected (40 rows, 312 empty), nothing paid; fixed dataset ignored, released after review (#43) | Work hashes recomputed with deliverableHash and identical to the site; README #7–#12 | Correct. **Fixed:** payment chips were clipped, the release row was hidden under the terminal; the click is labelled as shown in the app (the cleaning agent released it via the SDK) |
| 1:45 | 06 Attack | Stolen classical key tries to withdraw 3.2 QOR and deliver junk (unit 3); both BadPqcSignature; simulated, nothing spent | agents-demo.mjs step 6 (forged signature from a fresh key, simulateContract), README note on simulated calls | Correct, and labelled "run against Diana as simulated calls · nothing spent" |
| 2:05 | 07 Off switch | Olivia signs "Treaty: owner switches off agent …"; next acceptance fails AgentNotAuthorized | Treaty.sol revokeMessage; README #13–#14 | **Fixed:** the dialog now shows the exact signed text including "change #1" (setMandate used nonce 0, then incremented). Labelled as shown in the app (the run used the SDK) |
| 2:12 | 08 Refund | After the deadline 4 QOR goes to Olivia, not the agent; 6 QOR paid for three datasets | README #15–#16, app toast "4 QOR returned to 0x832475…7BEC2." | Correct. **Fixed:** caption had 26 words for 6 s; shortened and given 6.7 s; terminal no longer fades over the page |
| 2:19 | 09 Withdrawals | Data agent 4.8 QOR, cleaning agent 1.2 QOR, with their ML-DSA-87 keys | README #17–#18, statement screenshot | Correct. **Fixed:** this step had no narration (5 s gap); added a voiceover line |
| 2:25 | Proof | 18/18 transactions, receipts #41–#44 with explorer hashes, contract 0xDfc6…D0a6 | diana-demo.json (cosmosTx), README | Correct |
| 2:34 | QoreX | "Treaty: accept delivery 0 of treaty #1", work 0x7b51a8…, contract, chain 9800 | protocol.js reviewMessage/signedMessage | Text exact. The dialog is a stylised mock-up and the acceptance is a re-enactment; now labelled on screen |
| 2:45 | Track | Scoped EVM window, spending rules, authenticated messaging, Cross-VM receipts | story.js "Built for the track", README track table | Correct. **Fixed:** its "06" badge clashed with step 06; now ✓ |
| 2:53 | Close | Logo, "Binding agent deals", tagline, CTA, #BuildBeforeQDay | Your brief | Correct. Note: README/SUBMISSION use treatyv1.vercel.app; the video uses treaty-rust.vercel.app as asked |

## Timing

- Length 2:59 (5,370 frames at 30 fps). Every section starts on a beat of the 120 BPM score.
- Voiceover: 33 lines, every one at or under 2.6 words/s (calm narration). Before: one line at 3.4 and a
  silent step.
- Captions: each stays on screen for at least 0.3 s per word + 1 s (about 200 words a minute), give or take
  0.3 s for three of them. Before: four captions were cut short, one by more than half.
- Picture and sound cues come from one file (src/timeline.mjs); the audit above was re-run after every change.

## Open choices for you

1. How the voice says "QOR": "Q-O-R" or "core" (see out/voiceover/VOICEOVER.md).
2. Which URL is live for judges: treaty-rust.vercel.app (in the video) or treatyv1.vercel.app (in the README).
