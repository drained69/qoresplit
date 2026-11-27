// The single source of timing for the Treaty demo video.
// Visuals (Remotion), subtitles (scripts/srt.mjs) and sound (scripts/audio.mjs) all read this file,
// so a cue can never drift between picture and sound.
//
// 30 fps. 120 BPM: one beat = 15 frames, one bar = 60 frames (2 s).
// The script's sections start at 0:00, 0:20, 0:45, 1:05, 1:20, 1:45, 2:05, 2:25 and 2:45: every one is
// on a beat (a multiple of 15 frames), so every cut lands on the beat.

export const FPS = 30;
export const BEAT = 15;
export const BAR = 60;
export const s = (seconds) => Math.round(seconds * FPS);
export const DURATION = s(179); // 2:59

/** The nine sections of SUBMISSION.md, section 5. */
export const SECTIONS = [
  { id: 'hook', from: s(0), to: s(20), title: 'Cover and hook' },
  { id: 'mandate', from: s(20), to: s(45), title: '1. Olivia puts her agent on a budget' },
  { id: 'deal', from: s(45), to: s(65), title: '2–4. Propose, sign, lock the budget' },
  { id: 'refuse', from: s(65), to: s(80), title: 'The refused second treaty' },
  { id: 'work', from: s(80), to: s(105), title: '5. Work delivered, checked and paid' },
  { id: 'attack', from: s(105), to: s(125), title: '6. The stolen key' },
  { id: 'off', from: s(125), to: s(145), title: '7–9. Off switch, refund, withdrawals' },
  { id: 'proof', from: s(145), to: s(165), title: 'Proof on Diana and Native, QoreX' },
  { id: 'close', from: s(165), to: DURATION, title: 'Requirements and close' },
];
export const section = (id) => SECTIONS.find((item) => item.id === id);

// ------------------------------------------------------------------ cues (absolute frames)
export const CUE = {
  // hook
  coverOut: 120,
  problemAgents: 130,
  problemTrust: 200,
  problemKey: 290,
  problemGone: 360,
  quantum: 400,
  quantumCrack: 455,
  fixes: 545,

  // 1. mandate
  termIn: 612,
  cmdStart: 630,
  browserIn: 780,
  agentSeal: 1000,
  ownerSeal: 1060,
  limitsToast: 1130,

  // 2-4. deal
  dealPage: 1350,
  sign1: 1525,
  sign2: 1590,
  sign3: 1650,
  liveToast: 1665,
  lockedTerm: 1760,
  locked: 1775,
  lockedToast: 1780,

  // refusal
  secondDeal: 1990,
  secondMeter: 2050,
  refused: 2145,

  // 5. work
  workPage: 2400,
  deliver0: 2440,
  accept0: 2570,
  deliver1: 2640,
  reject1: 2700,
  deliver2: 2790,
  reviewOver: 2900,
  releaseClick: 2960,
  released: 2966,

  // 6. attack
  attackIn: 3150,
  keyStolen: 3200,
  try1: 3310,
  block1: 3400,
  try2: 3425,
  block2: 3470,
  nothingSpent: 3560,

  // 7-9.
  offPage: 3750,
  offClick: 3800,
  qorexIn: 3812,
  qorexApprove: 3870,
  switchedOff: 3880,
  notAuthorized: 3950,
  refundPage: 3960,
  refund: 4040,
  withdrawPage: 4160,
  withdrawData: 4200,
  withdrawCleaner: 4250,

  // proof
  proofIn: 4350,
  explorerRows: 4440,
  qorexScene: 4620,
  qorexDemoClick: 4680,
  qorexDemoSheet: 4692,
  qorexDemoApprove: 4800,
  qorexDemoVerified: 4815,

  // close
  reqsIn: 4950,
  closeIn: 5190,
};

// ------------------------------------------------------------------ captions
/** One caption per step: number, label, headline, supporting line (script, story.js and README). */
export const CAPTIONS = [
  { from: s(20), to: s(45), n: '01', label: 'The rules', head: 'Olivia puts her agent on a budget',
    line: 'At most 10 QOR per deal and 15 QOR in total, for 7 days. Both sign with ML-DSA-87.' },
  { from: s(45), to: CUE.sign1 - 10, n: '02', label: 'The deal', head: 'The research agent proposes a deal',
    line: '“Clean five survey datasets”: 2 QOR each, up to 5.' },
  { from: CUE.sign1 - 10, to: CUE.lockedTerm - 10, n: '03', label: 'The deal', head: 'Every party signs the exact terms',
    line: 'Each signature is ML-DSA-87. The contract checks every one on chain with pqcVerify.' },
  { from: CUE.lockedTerm - 10, to: s(65), n: '04', label: 'The deal', head: 'The research agent locks the budget',
    line: '10 QOR now sits in the contract, where the providers can see it.' },
  { from: s(65), to: s(80), n: '04', label: 'Owner’s limit', head: 'It tries to commit to a second 10 QOR deal',
    line: '20 QOR would break Olivia’s 15 QOR limit. Refused on chain: MandateLimitExceeded.' },
  { from: s(80), to: s(105), n: '05', label: 'The work', head: 'Work is delivered, checked and paid',
    line: 'Only its hash goes on chain. Accepted: paid 80/20. Rejected: nothing. Ignored: released after review.' },
  { from: s(105), to: s(125), n: '06', label: 'The attack', head: 'An attacker steals the data agent’s wallet key',
    line: 'Withdrawing or delivering junk needs the post-quantum key it doesn’t have. Refused: BadPqcSignature.', dark: true },
  { from: s(125), to: CUE.refundPage, n: '07', label: 'The off switch', head: 'Olivia switches her agent off',
    line: 'One post-quantum signature. Its next acceptance fails: AgentNotAuthorized.' },
  { from: CUE.refundPage, to: CUE.withdrawPage, n: '08', label: 'The end', head: 'The deadline passes',
    line: '6 QOR paid for three datasets. The unused 4 QOR goes to Olivia, not the agent.' },
  { from: CUE.withdrawPage, to: s(145), n: '09', label: 'The end', head: 'Withdrawals need the post-quantum key',
    line: 'Data agent 4.8 QOR, cleaning agent 1.2 QOR.' },
  { from: s(145), to: CUE.qorexScene, n: '✓', label: 'Live on Diana', head: 'This already happened, on the real testnet',
    line: 'Every agreement and payment also writes a receipt on QoreChain Native, through the Cross-VM bridge.' },
  { from: CUE.qorexScene, to: s(165), n: '✓', label: 'Readable signatures', head: 'People see exactly what they sign',
    line: 'QoreX signs in the browser with ML-DSA-87. Agents sign the same bytes with the SDK.' },
];

// ------------------------------------------------------------------ voiceover subtitles (SUBMISSION.md §5)
export const SUBTITLES = [
  [12, 130, 'AI agents are starting to pay each other.'],
  [130, 225, 'Today that means trusting the other agent,'],
  [225, 395, 'or giving a bot a key whose limits live in its own code.'],
  [395, 545, 'And that money is exactly what a quantum computer would steal.'],
  [545, 598, 'Treaty fixes both.'],
  [606, 800, 'Every party here is a separate agent with its own post-quantum key on QoreChain.'],
  [800, 960, 'Olivia, a human, owns the research agent and sets its limits:'],
  [960, 1100, 'ten QOR per deal, fifteen in total.'],
  [1100, 1250, 'The contract enforces them.'],
  [1356, 1530, 'The agents sign the exact terms with ML-DSA-87.'],
  [1530, 1700, 'The contract checks every signature on chain with pqcVerify.'],
  [1700, 1940, 'The budget is locked in the contract, so the data agents know it’s there.'],
  [1956, 2130, 'The agent tries to commit more than Olivia allowed.'],
  [2135, 2320, 'Refused, by the contract.'],
  [2406, 2560, 'Work is delivered; only its hash goes on chain.'],
  [2560, 2750, 'Good data is accepted and paid, bad data rejected.'],
  [2760, 2870, 'When the client goes quiet,'],
  [2870, 3060, 'anyone can release the payment after the review period.'],
  [3156, 3300, 'An attacker steals the data agent’s wallet key.'],
  [3300, 3440, 'It tries to withdraw and to deliver junk.'],
  [3445, 3530, 'Both blocked:'],
  [3530, 3720, 'every action needs the post-quantum key.'],
  [3756, 3880, 'Olivia switches her agent off.'],
  [3880, 4000, 'It can’t sign anything any more,'],
  [4000, 4190, 'and the unused budget goes back to her, not the agent.'],
  [4205, 4345, 'The team withdraws its pay with its own post-quantum keys.'],
  [4356, 4520, 'Every agreement and payment also writes a receipt on QoreChain Native'],
  [4520, 4670, 'through the Cross-VM bridge, verifiable on both VMs.'],
  [4680, 4800, 'People can sign in the browser with QoreX,'],
  [4800, 4940, 'and see exactly what they approve.'],
  [4956, 5110, 'Scoped windows, on-chain spending rules, authenticated messages,'],
  [5110, 5195, 'all post-quantum.'],
  [5200, 5360, 'Treaty: binding deals between AI agents, safe after Q-Day.'],
];

// ------------------------------------------------------------------ the agents demo, on Diana
// The real lines of examples/agents-demo.mjs, with the real addresses and hashes of the
// 26 November 2026 run (deployments/diana-demo.json). `f` is when a line starts to type.
const P = {
  olivia: '0x8324…BEC2', research: '0x378C…b998', data: '0xD775…E5e9', cleaner: '0x9fd3…1854',
};
export const TERMINAL = [
  { f: CUE.cmdStart, kind: 'cmd', text: 'npm run demo -- --diana' },
  { f: 700, text: 'Treaty demo on QoreChain Diana. Every party has its own ML-DSA-87 key.' },
  { f: 718, text: 'Treaty contract: 0xDfc61ec824205AEF7f2FC80FaD5DBC2Cc987D0a6' },
  { f: 736, text: `   Olivia, a human (${P.olivia}) owns the research agent.` },
  { f: 752, text: `   Research agent (${P.research}) needs survey data cleaned.` },
  { f: 768, text: `   Data agent (${P.data}) and Cleaning agent (${P.cleaner}) sell data cleaning as a team, 80/20.` },
  { f: 840, kind: 'step', text: '1. Olivia puts her agent on a budget' },
  { f: 1080, kind: 'tx', text: '     ↳ 0x778c28c2d0383b6cfbb0c00a7102ecab9f45078d4164efe54e8e4c6fa922cf58' },
  { f: 1110, kind: 'ok', text: '   Both signed with ML-DSA-87: at most 10 QOR per treaty, 15 QOR more in total, for 7 days. The contract enforces it.' },

  { f: 1360, kind: 'step', text: '2. The research agent proposes a deal' },
  { f: 1385, text: '   Treaty #1: 2 QOR per cleaned dataset, up to 5, within 9 minutes. The client has 60 seconds to review each delivery.' },
  { f: 1440, kind: 'step', text: '3. Every party reads the terms and signs them' },
  { f: CUE.sign1 - 4, kind: 'tx', text: '     ↳ 0x94455203160fd0401422a8183ff0babfc8e39627092a02fd12ed7e7d14cf365c' },
  { f: CUE.sign1 + 14, kind: 'ok', text: `   Data agent (${P.data}) checked "Clean five survey datasets" and signed.` },
  { f: CUE.sign2 - 4, kind: 'tx', text: '     ↳ 0x7ccddb392418ed3882fa9f33f3e021420332934fac849ce481faa6cc118317bd' },
  { f: CUE.sign2 + 14, kind: 'ok', text: `   Cleaning agent (${P.cleaner}) checked "Clean five survey datasets" and signed.` },
  { f: CUE.sign3 - 4, kind: 'tx', text: '     ↳ 0xc144fdb9198b8086e3f2b53b0c09d15bbe30295803d7665ab3b32596a1586921' },
  { f: CUE.sign3 + 14, kind: 'ok', text: `   Research agent (${P.research}) checked "Clean five survey datasets" and signed.` },
  { f: CUE.sign3 + 44, kind: 'ok', text: '   All signed: the treaty is live, and its terms are recorded on QoreChain Native.' },
  { f: CUE.lockedTerm - 30, kind: 'step', text: '4. The research agent locks the budget' },
  { f: CUE.lockedTerm - 6, kind: 'tx', text: '     ↳ 0x26b2fd06c5a1394133a00cee2dc5350a431d930217b1039cbd02466aad88426b' },
  { f: CUE.lockedTerm + 14, kind: 'ok', text: '   10 QOR is locked in the contract. The data team can see it is there before they start.' },

  { f: 2010, kind: 'tx', text: '     ↳ 0x3ff24cff10bdf52561aa5c29829932612cbfbc181f0697cb05bd48cc1d2eb262' },
  { f: CUE.refused - 10, kind: 'bad', text: '   It tries to commit another 10 QOR elsewhere: refused (MandateLimitExceeded). Olivia’s limit holds.' },

  { f: 2408, kind: 'step', text: '5. Work is delivered, checked and paid' },
  { f: CUE.deliver0, kind: 'tx', text: '     ↳ 0x4833e410dd7b28193c415d2fa849c2d28503269fd3f0e4f6f752a3d0d793bdc3' },
  { f: CUE.accept0 - 6, kind: 'tx', text: '     ↳ 0x83e254cb2323ab8e604b90da66e2c97692fad1d6cd62b0cf995b2580f4dbe5ce' },
  { f: CUE.accept0 + 10, kind: 'ok', text: '   Dataset 1 delivered. The research agent checks it and accepts: 1.6 QOR to the data agent, 0.4 to the cleaner.' },
  { f: CUE.deliver1, kind: 'tx', text: '     ↳ 0xfe2e2cfbbebb3b17a9f60981134dd39b45a86aa31a19c3a8118492dbf9775bc8' },
  { f: CUE.reject1 - 4, kind: 'tx', text: '     ↳ 0xf5fc792b78feaad39941bdbcd6e2512babef78101997bec4e451d696f643dc4f' },
  { f: CUE.reject1 + 10, text: '   Dataset 2 delivered. The research agent rejects it: only 40 rows with 312 empty values. Nothing is paid.' },
  { f: CUE.deliver2, kind: 'tx', text: '     ↳ 0xc10d5a5d0af294f7b5d98c1c24c265d9d7a96c410721f5be9ab4be26987451ce' },
  { f: CUE.deliver2 + 18, text: '   Dataset 2 is delivered again, fixed. This time the research agent is busy and does not answer.' },
  { f: CUE.deliver2 + 50, kind: 'dim', text: '   Waiting 61 seconds of chain time on Diana…' },
  { f: CUE.released, kind: 'tx', text: '     ↳ 0x8822c27c80eec3705a2ce43157c407366eb8a49f90abc42a3fd4751674f8f189' },
  { f: CUE.released + 20, kind: 'ok', text: '   After the review period anyone may release it, and the cleaning agent does: the team is paid without waiting.' },

  { f: CUE.attackIn + 10, kind: 'step', text: '6. An attacker steals the data agent’s wallet key' },
  { f: CUE.block1 - 12, kind: 'bad', text: '   With the classical key alone it tries to withdraw its 3.2 QOR: BLOCKED (BadPqcSignature).' },
  { f: CUE.block2 - 12, kind: 'bad', text: '   With the classical key alone it tries to deliver junk to get paid: BLOCKED (BadPqcSignature).' },

  { f: CUE.offPage + 6, kind: 'step', text: '7. Olivia switches her agent off' },
  { f: CUE.switchedOff, kind: 'tx', text: '     ↳ 0xc6be277316e7014cf75065fa09377ef2f742a46d8ba38d49f6bfe229669a51b0' },
  { f: CUE.notAuthorized - 24, kind: 'tx', text: '     ↳ 0x94e9e9cc517206c0339eb08bcbe7a94a69e8f8142808ce09366e8fee86075d9f' },
  { f: CUE.notAuthorized - 8, kind: 'bad', text: '   The research agent can no longer sign anything: AgentNotAuthorized.' },
  { f: CUE.refundPage, kind: 'step', text: '8. The deadline passes' },
  { f: CUE.refundPage + 14, kind: 'tx', text: '     ↳ 0x518cfeed74aaa3e5ce025c8c0063e63d45ff8cb45ee3f76d1eef2f5114e44164' },
  { f: CUE.refundPage + 30, text: '   The last delivery was never reviewed, so it is released and paid.' },
  { f: CUE.refund - 4, kind: 'tx', text: '     ↳ 0x2289469639e8082fc37ad87ecc8a9a799ce0de001f5022a31cc910d3da7979b2' },
  { f: CUE.refund + 12, kind: 'ok', text: '   The unused budget, 4 QOR, goes back to Olivia, not to the switched-off agent.' },
  { f: CUE.withdrawPage, kind: 'step', text: '9. The team withdraws with their post-quantum keys' },
  { f: CUE.withdrawData - 4, kind: 'tx', text: '     ↳ 0x50f240f23a0e0f796674070973c8c0694c93be6a7ce03184b88ea7aceeecd86e' },
  { f: CUE.withdrawData + 12, kind: 'ok', text: `   Data agent (${P.data}) withdrew 4.8 QOR.` },
  { f: CUE.withdrawCleaner - 4, kind: 'tx', text: '     ↳ 0x72a4a36bac90734d2c4e818fb6f38bbb6f501c76e3b8bdccf112fd3ef2007905' },
  { f: CUE.withdrawCleaner + 12, kind: 'ok', text: `   Cleaning agent (${P.cleaner}) withdrew 1.2 QOR.` },
  { f: CUE.withdrawCleaner + 40, kind: 'step', text: 'Done' },
  { f: CUE.withdrawCleaner + 52, text: '   Treaty #1: 3 datasets paid, 1 rejected, budget settled.' },
  { f: CUE.withdrawCleaner + 66, text: '   Every signature above was checked by Diana’s own pqcVerify precompile.' },
];
/** Typing speed: the command is typed by a person, output streams. */
export const charsPerFrame = (kind) => (kind === 'cmd' ? 0.55 : kind === 'tx' ? 6 : 3.2);
export const typedLength = (line, frame) => Math.max(0, Math.min(line.text.length, Math.floor((frame - line.f) * charsPerFrame(line.kind))));

/** When the terminal window is on screen (it slides in and out over the browser). */
export const TERMINAL_SHOWN = [
  [CUE.termIn, 900], [1355, 1515], [1700, 1830], [1990, 2240],
  [2404, 2470], [3045, 3140], [CUE.offPage, 3830], [3925, 3962], [CUE.withdrawPage, 4345],
];
// The attack has its own terminal pane; the lines above for 3150-3750 appear there.

// ------------------------------------------------------------------ cursor paths (stage coordinates)
// Each entry: [frame, x, y, click?]. Coordinates are in the browser page's own CSS pixels and are
// resolved per layout by the scenes.
export const CLICKS = {
  release: CUE.releaseClick,
  offButton: CUE.offClick,
  qorexApprove: CUE.qorexApprove,
  demoAccept: CUE.qorexDemoClick,
  demoApprove: CUE.qorexDemoApprove,
};

// ------------------------------------------------------------------ toasts (the app's #status messages)
export const TOASTS = [
  { f: CUE.limitsToast, to: CUE.limitsToast + 110, text: 'The agent’s limits are set.' },
  { f: CUE.liveToast, to: CUE.liveToast + 100, text: 'Final signature recorded. The treaty is live.' },
  { f: CUE.lockedToast, to: CUE.lockedToast + 120, text: '10 QOR is locked. Providers can deliver now.' },
  { f: CUE.released + 4, to: CUE.released + 100, text: 'Delivery 2 released and paid.' },
  { f: CUE.qorexIn, to: CUE.qorexApprove + 6, text: 'Approve the message in QoreX…', pending: true },
  { f: CUE.switchedOff + 6, to: CUE.switchedOff + 110, text: 'The agent is switched off.' },
  { f: CUE.refund + 6, to: CUE.refund + 120, text: '4 QOR returned to 0x832475…7BEC2.' },
  { f: CUE.qorexDemoSheet, to: CUE.qorexDemoApprove + 6, text: 'Approve the message in QoreX…', pending: true },
  { f: CUE.qorexDemoVerified, to: CUE.qorexDemoVerified + 120, text: 'Delivery 0 accepted and paid.' },
];

// ------------------------------------------------------------------ sound effects, from the cues above
export function soundCues() {
  const cues = [];
  const add = (f, type, gain = 1) => cues.push({ f, type, gain });
  // typing: the command at a person's pace, output as soft ticks
  for (const line of TERMINAL) {
    const frames = Math.ceil(line.text.length / charsPerFrame(line.kind));
    const step = line.kind === 'cmd' ? 2 : 4;
    for (let i = 0; i < frames; i += step) add(line.f + i, 'key', line.kind === 'cmd' ? 1 : 0.35);
  }
  // clicks
  for (const f of Object.values(CLICKS)) add(f, 'click');
  // seals (ML-DSA-87 signatures)
  for (const f of [CUE.agentSeal, CUE.ownerSeal, CUE.sign1, CUE.sign2, CUE.sign3, CUE.qorexApprove + 8, CUE.qorexDemoApprove + 8]) add(f, 'stamp');
  // payments
  for (const f of [CUE.locked, CUE.accept0, CUE.accept0 + 8, CUE.released, CUE.released + 8, CUE.refund, CUE.withdrawData, CUE.withdrawCleaner]) add(f, 'coin');
  // toasts
  for (const toast of TOASTS) if (!toast.pending) add(toast.f, 'toast');
  // refusals
  for (const f of [CUE.refused, CUE.block1, CUE.block2, CUE.notAuthorized]) add(f, 'thud');
  add(CUE.reject1, 'tick');
  // whooshes on big moves
  for (const f of [CUE.coverOut, CUE.quantum, s(20), s(45), s(65), s(80), s(125), s(145), CUE.qorexScene, CUE.reqsIn, CUE.closeIn]) add(f - 6, 'whoosh', 0.6);
  add(CUE.keyStolen, 'glitch');
  add(CUE.quantumCrack, 'glitch', 0.7);
  return cues.sort((a, b) => a.f - b.f);
}
