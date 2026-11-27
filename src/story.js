// The home page and the live deal page: what Treaty is, and the proof it works on Diana.
import demo from '../deployments/diana-demo.json';
import deployment from '../deployments/diana.json';

/** Act two, once it has run on Diana: the owner's money under QoreChain's own spending rules. */
const actTwo = Object.values(import.meta.glob('../deployments/diana-smart-account.json', { eager: true, import: 'default' }))[0];

/** Transaction links open Treaty's own page for it, read from Diana (the explorer needs its Testnet cookie). */
const explorer = (hash) => '#tx/' + deployment.contract.address + '/' + hash;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const tx = Object.fromEntries(demo.steps.map((step) => [step.step, step]));
const shortHash = (hash) => hash.slice(0, 10) + '…' + hash.slice(-6);

export const liveFacts = {
  contract: deployment.contract.address,
  transactions: demo.steps.length,
  receipts: 4,
  date: '26 November 2026',
};

// ------------------------------------------------------------------ home

export function homeHtml() {
  return `
  <section class="hero">
    <div class="shell hero-inner">
      <div class="hero-copy">
        <p class="kicker">Post-Quantum AI Agents · live on QoreChain Diana</p>
        <h1>Binding deals between AI agents, <em>safe after Q&#8209;Day.</em></h1>
        <p class="lead">AI agents are starting to hire and pay each other. With Treaty they agree on terms signed with post-quantum keys, a contract holds the money and pays only as agreed, and owners set limits their agents cannot break.</p>
        <div class="cta">
          <a class="primary arrow" href="#live">See the deal on Diana</a>
          <a class="secondary" href="#home/how">How it works</a>
        </div>
        <p class="hero-facts"><span><b>${demo.steps.length}</b> transactions on Diana</span><span><b>4</b> receipts on QoreChain Native</span><span><b>0</b> failed</span></p>
      </div>
      <figure class="instrument" aria-label="Treaty number 1, as recorded on Diana">
        <header><span>Treaty No. 1</span><span>Service · qorechain-diana</span></header>
        <h2>Clean five survey datasets</h2>
        <dl class="clauses">
          <div><dt>Price</dt><dd>2 QOR per dataset, at most 5</dd></div>
          <div><dt>Split</dt><dd>Data agent 80% · Cleaning agent 20%</dd></div>
          <div><dt>Budget</dt><dd>10 QOR, held by the contract</dd></div>
          <div><dt>Review</dt><dd>60 seconds, then anyone may release</dd></div>
          <div><dt>Owner's limit</dt><dd>10 QOR a deal, 15 in total, 7 days</dd></div>
        </dl>
        <p class="sig-head">Signed by</p>
        <div class="signatories">
          ${signatory('Data agent', 'Provider', 'Data agent signs the terms')}
          ${signatory('Cleaning agent', 'Provider', 'Cleaning agent signs the terms')}
          ${signatory('Research agent', 'Client', 'Research agent signs the terms')}
        </div>
        <footer><span>Settled</span>3 datasets paid · 1 rejected · 4 QOR back to the owner</footer>
      </figure>
    </div>
  </section>

  <section class="section shell" id="what">
    <span class="label">What Treaty is</span>
    <h2 class="big">A contract that agents can trust, <em>so they don't have to trust each other.</em></h2>
    <p class="sub">Today, an agent that pays another agent either trusts it, or trusts whoever holds the money. And a bot's spending limits usually live in its own code: one bug or stolen key and they are gone. Treaty moves the deal, the money and the limits onto the chain.</p>
    <div class="features">
      <article class="feature"><h3>Everyone signs the terms</h3><p>Every agent and person accepts the exact deal with its ML-DSA-87 post-quantum key. The chain checks each signature. Nobody is committed without signing.</p></article>
      <article class="feature"><h3>The contract holds the money</h3><p>The client locks the budget first, so workers know it's there. It's paid out per accepted job, and what's left goes back after the deadline.</p></article>
      <article class="feature"><h3>A stolen key gets nothing</h3><p>Ordinary wallet keys are what a quantum computer breaks. Every action that moves money needs the post-quantum key too, so a stolen classical key can't do anything.</p></article>
      <article class="feature"><h3>Owners keep control</h3><p>A human owner sets how much an agent may commit, in total and per deal, and for how long. One signature switches the agent off; its money then answers only to the owner.</p></article>
    </div>
  </section>

  <section class="section shell" id="how">
    <span class="label">How it works</span>
    <h2 class="big">Four steps, <em>all enforced on chain.</em></h2>
    <div class="steps">
      ${stepHtml('01', 'The owner sets the limits.', 'Before the agent can spend anything.', 'Olivia lets her research agent commit <b>at most 10 QOR per deal and 15 QOR in total, for 7 days</b>. Both sign. If the agent tries to go further, the contract refuses.',
        `<div class="mini"><span>Max per deal<small>Set by the owner</small></span><span class="mono">10 QOR</span></div>
         <div class="mini"><span>Max in total<small>Across every deal</small></span><span class="mono">15 QOR</span></div>
         <div class="mini"><span>A second 10 QOR deal<small>Would make 20 in total</small></span><span class="no">Refused</span></div>`)}
      ${stepHtml('02', 'Agents agree, and lock the money.', 'Terms signed, budget visible.', 'The research agent proposes <b>2 QOR per cleaned dataset, up to 5</b>. The data agent, the cleaning agent and the research agent each sign the exact terms with their post-quantum keys. Then <b>10 QOR is locked in the contract</b>, where everyone can see it.',
        `<div class="mini"><span>Data agent<small>Provider · 80%</small></span><span class="ok">Signed</span></div>
         <div class="mini"><span>Cleaning agent<small>Provider · 20%</small></span><span class="ok">Signed</span></div>
         <div class="mini"><span>Research agent<small>Client · within its limits</small></span><span class="ok">Signed</span></div>
         <div class="mini"><span>Budget<small>Held by the contract</small></span><span class="mono">10 QOR</span></div>`)}
      ${stepHtml('03', 'Work is delivered, checked and paid.', 'Silence counts as yes.', 'A provider delivers a dataset; only its fingerprint goes on chain. The client <b>accepts</b> it (paid at once, split 80/20) or <b>rejects</b> it within the review period. If the client says nothing, <b>anyone can release the payment</b> afterwards.',
        `<div class="mini"><span>Dataset 1<small>1,200 clean rows</small></span><span class="ok">Accepted · 2 QOR</span></div>
         <div class="mini"><span>Dataset 2<small>40 rows, 312 empty</small></span><span class="no">Rejected · 0</span></div>
         <div class="mini"><span>Dataset 2, fixed<small>The client was busy</small></span><span class="ok">Released · 2 QOR</span></div>`)}
      ${stepHtml('04', 'Keys get stolen. Agents get switched off.', 'The money stays safe either way.', 'An attacker with the data agent\'s ordinary wallet key tries to take its earnings: <b>blocked</b>, it has no post-quantum key. Olivia switches her agent off: it can\'t sign anything any more, and <b>the unused budget goes back to her</b>, not to the agent.',
        `<div class="mini"><span>Attacker withdraws 3.2 QOR<small>Classical key only</small></span><span class="no">Blocked</span></div>
         <div class="mini"><span>Switched-off agent accepts work<small>After the owner said stop</small></span><span class="no">Refused</span></div>
         <div class="mini"><span>Unused budget<small>After the deadline</small></span><span class="ok">4 QOR → owner</span></div>`)}
    </div>
  </section>

  <section class="section shell" id="proof">
    <span class="label">Live on Diana</span>
    <h2 class="big">This already happened, <em>on the real testnet.</em></h2>
    <p class="sub">On ${liveFacts.date}, four separate accounts ran the whole story above on QoreChain's Diana testnet. Each acted through its own EVM window that allows only the Treaty contract.</p>
    <div class="proof">
      <div class="stat"><strong>${liveFacts.transactions}/${liveFacts.transactions}</strong><span>transactions succeeded</span></div>
      <div class="stat"><strong>${liveFacts.receipts}</strong><span>receipts also written on QoreChain Native</span></div>
      <div class="stat"><strong>3</strong><span>attacks and overreaches refused</span></div>
      <div class="stat"><strong>0</strong><span>times anyone held the money but the contract</span></div>
    </div>
    <div class="facts">
      <div><span>Contract</span><a href="${explorer(deployment.contract.deployTx)}"><code>${escape(deployment.contract.address)}</code> ↗</a></div>
      <div><span>Deployed</span><strong>Block ${deployment.contract.block.toLocaleString('en-US')} · ${deployment.contract.gasUsed.toLocaleString('en-US')} gas · code verified against this build</strong></div>
      <div><span>Treaty goes live</span><a href="${explorer(tx['Research agent signs the terms'].tx)}">Last signature, terms recorded on Native (receipt #41) ↗</a></div>
      <div><span>First payment</span><a href="${explorer(tx['the client accepts it'].tx)}">Accepted delivery, 1.6 + 0.4 QOR, receipt #42 ↗</a></div>
      <div><span>Owner's off switch</span><a href="${explorer(tx['the owner switches the agent off'].tx)}">Research agent switched off ↗</a></div>
      <div><span>Refund</span><a href="${explorer(tx['the unused budget goes back'].tx)}">Unused 4 QOR returned to the owner ↗</a></div>
    </div>
    <div class="cta" style="margin-top:24px"><a class="pill arrow" href="#live">Replay the deal, step by step</a></div>
  </section>

  <section class="section shell" id="security">
    <span class="label">Security model</span>
    <h2 class="big">Every way it could go wrong, <em>and what stops it.</em></h2>
    <p class="sub">Treaty has no administrator, no pause switch and no upgrade path. Its guarantees come from the contract and from QoreChain's post-quantum precompiles alone.</p>
    <div class="threats">
      ${threat('An agent\'s wallet key is stolen, or broken by a quantum computer', 'Every action that commits a party or moves money needs an ML-DSA-87 signature, verified on chain against the key registered for that account. The classical key alone can sign nothing.', 'Shown live: withdrawal and junk delivery refused with BadPqcSignature')}
      ${threat('An agent overspends, or is manipulated into a bad deal', 'The owner\'s mandate caps each deal and the total committed, and expires. The contract checks it when the agent signs and again when money is locked; the agent\'s EVM window allows only the Treaty contract, a few transactions and a capped value.', 'Shown live: a second 10 QOR deal refused with MandateLimitExceeded')}
      ${threat('The client takes the work and never pays', 'The whole budget is locked in the contract before work counts. A delivery the client neither accepts nor rejects within the review period can be released by anyone.', 'Shown live: an ignored delivery released and paid')}
      ${threat('A provider is paid for work the client did not want', 'The client may reject a delivery within the review period; the unit is not paid and can be delivered again. Payments never exceed price × units.', 'Shown live: a 40-row dataset rejected, nothing paid')}
      ${threat('Someone replays an old signature, or changes the deal after signing', 'Each signed message names the chain, the contract and exactly what it authorises: the terms hash, the work hash and unit, the amount and a per-account counter. Terms never change; a new deal needs new signatures from everyone.', 'Covered by tests: replayed and redirected withdrawals refused')}
      ${threat('The record on one VM disagrees with the other', 'Agreements and payments write their receipt on QoreChain Native in the same transaction, through the governance-pinned bridge. If either side fails, both are undone.', 'Verified: receipts #41 to #44 match their EVM commitments')}
    </div>
  </section>

  <section class="section shell" id="developers">
    <span class="label">For developers</span>
    <h2 class="big">An agent signs a treaty <em>in a few lines.</em></h2>
    <div class="dev">
      <pre class="code"><span class="cm">// Each agent runs with its own keys; nothing is shared.</span>
<span class="kw">const</span> agent = <span class="kw">await</span> Treaty.connect({ contract, mnemonic });

<span class="kw">const</span> id = <span class="kw">await</span> agent.proposeService({
  title: <span class="st">'Clean five survey datasets'</span>,
  unitPrice: <span class="st">'2'</span>, maxUnits: <span class="nu">5</span>, reviewPeriod: <span class="nu">600</span>, deadline,
  client: agent.address,
  providers: [dataAgent, cleaningAgent], shares: [<span class="nu">8000</span>, <span class="nu">2000</span>],
});
<span class="kw">await</span> agent.sign(id);        <span class="cm">// ML-DSA-87, checked against the on-chain terms</span>
<span class="kw">await</span> agent.fund(id);        <span class="cm">// locks 10 QOR, within the owner's limits</span>
<span class="kw">await</span> agent.accept(id, <span class="nu">0</span>);   <span class="cm">// pays one unit, split 80/20</span></pre>
      <dl class="spec">
        <div><dt>Contract</dt><dd>Solidity 0.8, ${Math.round(21179 / 1024)} KB, no owner or upgrade path. <a href="https://github.com/drained69/treaty/blob/main/contracts/Treaty.sol" target="_blank" rel="noreferrer">Treaty.sol ↗</a></dd></div>
        <div><dt>Post-quantum checks</dt><dd><code>pqcKeyStatus</code> (0x…0a02) reads each signer's registered ML-DSA-87 key; <code>pqcVerify</code> (0x…0a01) verifies every signature, about 315k gas each.</dd></div>
        <div><dt>Message format</dt><dd>QoreSign message-signing-v1 with readable text, so QoreX shows people exactly what they sign and agents sign the same bytes.</dd></div>
        <div><dt>Cross-VM</dt><dd>Receipts through the bridge at 0x…0901 into the governance-approved Native receipt book (code 865).</dd></div>
        <div><dt>Verification</dt><dd>25 contract, service and smart-account tests, 6 end-to-end tests (real ML-DSA-87 keys, a real browser, QoreX signing) and 21 read-only checks against Diana. <a href="https://github.com/drained69/treaty#verification" target="_blank" rel="noreferrer">How to run them ↗</a></dd></div>
      </dl>
    </div>
  </section>

  <section class="section shell" id="track">
    <span class="label">Built for the track</span>
    <h2 class="big">What the <em>Post-Quantum AI Agents</em> track asks for.</h2>
    <div class="reqs">
      <div class="req"><h3>Scoped EVM window<small>Transaction, value, time, target</small></h3><p>Each agent opens its own window, signed with its post-quantum key: it can only call the Treaty contract, at most 30 transactions, a capped value, for about an hour. The chain refuses anything else.</p></div>
      <div class="req"><h3>Smart-account spending rules<small>QoreChain abstractaccount · owner mandate</small></h3><p>Two layers. The owner links the agent's session key to her own account with QoreChain's smart-account module: the chain lets it call only <code>Treaty.fund</code> and <code>Treaty.refund</code>, caps each call and each day in QOR, and expires it; she revokes it in one transaction. Then Treaty's mandate caps each deal and the total, and its off switch stops the agent signing. Linking, changing and revoking all need the owner's ML-DSA-87 signature.</p></div>
      <div class="req"><h3>Authenticated messaging<small>QoreSign · ML-DSA-87</small></h3><p>Every message an agent sends (accept these terms, here is my work, I accept it, pay me) is a readable message signed with ML-DSA-87 and verified by the contract with QoreChain's <code>pqcVerify</code>.</p></div>
      <div class="req"><h3>Cross-VM receipts<small>EVM → Native, atomically</small></h3><p>Every agreement and payment also writes a receipt on QoreChain Native in the same transaction, through the governance-approved bridge. If either side fails, both are undone.</p></div>
    </div>
  </section>

  <section class="section shell faq" id="questions">
    <div><span class="label">Questions</span><h2 class="big" style="font-size:clamp(1.8rem,3.4vw,2.6rem)">The short answers.</h2></div>
    <div>
      ${faq('What is a "post-quantum" key, and why does it matter?', 'Ordinary crypto wallets use keys that a large quantum computer is expected to break. QoreChain gives every account a second key, ML-DSA-87, designed to resist that. Treaty asks for that key for everything that moves money, so even a broken or stolen ordinary key gets nothing.')}
      ${faq('Who holds the money?', 'Nobody. The Treaty contract holds it, and its rules are public: pay per accepted job, release ignored jobs after the review period, return the rest after the deadline. There is no admin, no pause button and no upgrade.')}
      ${faq('What if the client agent never answers?', 'Each delivery has a review period. If the client neither accepts nor rejects in time, anyone can release the payment, so workers are never stuck waiting.')}
      ${faq('Can an owner stop a misbehaving agent?', 'Yes. The owner switches the agent off with one signature. From then on the agent cannot sign anything in Treaty, only the owner can withdraw its earnings, and unused budgets go back to the owner.')}
      ${faq('Does the agent ever hold its owner\'s money?', 'No. The money stays in the owner\'s account until the moment a budget is locked. The agent holds a session key that the owner linked to her account with QoreChain\'s smart-account module; the chain lets that key call only Treaty.fund and Treaty.refund, within a per-call and a daily cap, until it expires or she revokes it. The agent\'s own account only relays and pays the fee. A stolen session key can lock budget only into deals the agent already signed with its post-quantum key, and unused budget always returns to the owner.')}
      ${faq('Do people need to run code?', 'No. People sign in this web app with the QoreX wallet and see exactly what they approve, in plain words. Agents use the Treaty SDK. Both produce the same signatures.')}
      ${faq('Is this live, or a mock-up?', 'Live. The contract is deployed on QoreChain\'s Diana testnet and the whole agents story ran there on 26 November 2026: 18 transactions, all linked on the live deal page. Test QOR has no monetary value; nothing on mainnet is involved.')}
      ${faq('What does it cost to use?', 'Only network fees. A signature check costs about 315,000 gas on Diana. Treaty takes no fee, and the contract has no owner who could add one.')}
      ${faq('Is it only for agents?', 'No. Treaty also does revenue shares: several people (or agents) sell something together and every payment is split automatically between them.')}
    </div>
  </section>

  <section class="start" id="start">
    <div class="shell">
      <span class="label">Start here</span>
      <h2>Make your agents sign before they spend.</h2>
      <p>Propose a treaty in the app, watch the live deal from Diana, or run the whole agents demo on your own computer in 30 seconds.</p>
      <div class="cta">
        <a class="pill light-btn arrow" href="#service">Make a treaty</a>
        <a class="ghost arrow" href="#live">See the live deal</a>
        <a class="ghost arrow" href="https://github.com/drained69/treaty" target="_blank" rel="noreferrer">Source code</a>
      </div>
      <pre>git clone https://github.com/drained69/treaty && cd treaty && npm ci && npm run demo</pre>
    </div>
  </section>`;
}

/** A signatory line: the party, its role, and the transaction that carried its ML-DSA-87 signature. */
function signatory(name, role, step) {
  const hash = tx[step]?.tx;
  return `<div class="signatory"><span class="sig-name">${name}<small>${role}</small></span>
    <span class="sig-line"><span class="sig-alg">ML-DSA-87 · 4,627 B</span>${hash ? `<a href="${explorer(hash)}">${shortHash(hash)}</a>` : ''}</span></div>`;
}

function stepHtml(count, title, tagline, body, panel) {
  return `<article class="step"><div><span class="count">Step ${Number(count)} of 4</span><h3>${title}</h3><p class="tagline">${tagline}</p><p class="body">${body}</p></div>
    <div class="panel">${panel}</div></article>`;
}

function threat(risk, defence, proof) {
  return `<article class="threat"><h3>${risk}</h3><p>${defence}</p><span class="proof-note">${proof}</span></article>`;
}

function faq(question, answer) {
  return `<details><summary>${question}</summary><p>${answer}</p></details>`;
}

// -------------------------------------------------------------- live deal

/** The live run, in plain words, with the transactions that prove each step. */
const story = [
  ['The rules', [
    ['owner sets the agent’s limits', 'Olivia puts her research agent on a budget', 'At most 10 QOR per deal and 15 QOR in total, for 7 days. Both the agent and Olivia sign with ML-DSA-87.', 'Limits set'],
  ]],
  ['The deal', [
    ['Data agent signs the terms', 'The data agent signs the terms', '"Clean five survey datasets", 2 QOR each, up to 5. It will receive 80% of each payment.', 'Signed'],
    ['Cleaning agent signs the terms', 'The cleaning agent signs', 'It will receive 20% of each payment.', 'Signed'],
    ['Research agent signs the terms', 'The research agent signs last: the treaty is live', 'Its owner\'s limits allow this deal. The terms are also recorded on QoreChain Native.', 'Live'],
    ['the client locks the budget', 'The research agent locks 10 QOR', 'The money now sits in the contract, where the data agents can see it before they start.', '10 QOR locked'],
    ['a second treaty for the data agent', 'It tries to commit to a second 10 QOR deal', 'The data agent signs a second deal, but the research agent\'s signature is refused: 20 QOR would break Olivia\'s 15 QOR limit.', 'Refused by the owner\'s limit', 'refused'],
  ]],
  ['The work', [
    ['the data agent delivers dataset 1', 'Dataset 1 is delivered', 'Only its fingerprint goes on chain. 1,200 rows, no empty values.', 'Delivered'],
    ['the client accepts it', 'The research agent checks it and accepts', 'Paid at once: 1.6 QOR to the data agent, 0.4 QOR to the cleaner, with a receipt on Native.', '+2 QOR paid'],
    ['the data agent delivers dataset 2', 'Dataset 2 is delivered', '40 rows, 312 empty values.', 'Delivered'],
    ['the client rejects it', 'The research agent rejects it', 'Nothing is paid; the unit can be delivered again.', 'Rejected · 0 paid', 'neutral'],
    ['the data agent delivers a fixed dataset', 'A fixed dataset 2 arrives', 'This time the research agent is busy and doesn\'t answer.', 'Delivered'],
    ['the cleaning agent releases the ignored delivery', 'The review period passes: anyone may release it', 'The cleaning agent does. The team is paid without waiting.', '+2 QOR paid'],
  ]],
  ['The attack', [
    [null, 'An attacker steals the data agent\'s wallet key', 'It tries to withdraw the data agent\'s 3.2 QOR, and to deliver junk to get paid. Both need the post-quantum key it doesn\'t have: refused by Diana with BadPqcSignature. Nothing was spent.', 'Blocked twice', 'refused'],
  ]],
  ['The off switch', [
    ['the owner switches the agent off', 'Olivia switches her agent off', 'One post-quantum signature. The research agent can no longer sign anything in Treaty.', 'Switched off'],
    ['the data agent delivers another dataset', 'Another dataset arrives', 'The switched-off agent tries to accept it, and is refused with AgentNotAuthorized.', 'Delivered'],
    ['the cleaning agent releases the last delivery', 'Nobody reviewed it, so it is released', 'The team is paid for honest work even though the client was switched off.', '+2 QOR paid'],
  ]],
  ['The end', [
    ['the unused budget goes back', 'The deadline passes: the rest goes back', '10 QOR locked, 6 QOR paid for three datasets. The unused 4 QOR goes to Olivia, not to the switched-off agent.', '4 QOR → owner'],
    ['Data agent withdraws', 'The data agent withdraws 4.8 QOR', 'Signed with its own post-quantum key.', '−4.8 QOR'],
    ['Cleaning agent withdraws', 'The cleaning agent withdraws 1.2 QOR', 'Every QOR is accounted for.', '−1.2 QOR'],
  ]],
];

const NATIVE_EXPLORER = 'https://explore.qore.network/tx/';
const actTwoStory = [
  ['owner renews the agent’s mandate (relayed by the agent)', 'Olivia renews her agent’s mandate', 'At most 6 QOR, for 2 days. Both sign with ML-DSA-87 and the agent relays it, so Olivia sends no EVM transaction at all.', 'Treaty’s limit'],
  ['owner links the session key with a spending rule', 'Olivia links the agent’s session key to her own account', 'One hybrid transaction on QoreChain Native (MsgUpdateSpendingRules + MsgRegisterAuthenticator): the key may call only Treaty.fund and Treaty.refund, at most 6 QOR per call and per day, for 24 hours.', 'QoreChain’s limit'],
  ['the data agent signs the terms', 'The data agent signs a new deal', '"Label four image batches", 1.5 QOR each, up to 4: a 6 QOR budget.', 'Signed'],
  ['the research agent signs: the treaty goes live', 'The research agent signs: the treaty is live', 'Within the renewed mandate. The terms are recorded on QoreChain Native.', 'Live'],
  ['the agent locks 6 QOR from the owner’s account (session key, chain-checked)', 'The agent locks 6 QOR straight from Olivia’s account', 'Its session key signs a MsgExecuteEVM; its own account relays it and pays the fee. QoreChain checks the rule, then Treaty checks the mandate. The money never passes through the agent.', '6 QOR locked'],
  ['session key tries an unlimited fUSD approval to the agent (refused by the chain)', 'The same key tries an unlimited token approval to itself', 'Not a call the rule allows.', 'Refused by QoreChain', 'refused'],
  ['session key tries to send 1 QOR from the owner to the agent (refused by the chain)', 'It tries to move 1 QOR of Olivia’s money to itself', 'Outside the rule.', 'Refused by QoreChain', 'refused'],
  ['the data agent delivers batch 1', 'Batch 1 is delivered', 'Only its fingerprint goes on chain.', 'Delivered'],
  ['the research agent accepts it: 1.5 QOR paid', 'The research agent accepts it', '1.5 QOR to the data agent from the locked budget, with a receipt on Native.', '+1.5 QOR paid'],
  ['owner revokes the session key', 'Olivia switches the session key off', 'One hybrid transaction, effective in the same block.', 'Revoked'],
  ['the revoked key tries to call Treaty.refund (refused by the chain)', 'The revoked key tries again', 'Even an allowed function is refused now.', 'Refused by QoreChain', 'refused'],
  ['the unused budget goes back to the owner', 'The deadline passes: 4.5 QOR goes back to Olivia', 'She locked it, so it returns to her. She paid for exactly one accepted batch.', '4.5 QOR → owner'],
];

function actTwoHtml() {
  const intro = `<div class="intro" style="margin-top:72px"><p class="eyebrow">Act two · QoreChain smart account</p>
    <h1 style="font-size:clamp(1.9rem,4vw,2.8rem)">The owner’s money, under <em>the chain’s own rules.</em></h1>
    <p>Olivia keeps her money in her own account. Her agent can reach it only through a session key she linked with QoreChain’s smart-account module, and the chain checks every call before Treaty does.</p></div>`;
  if (!actTwo?.steps?.length) {
    return intro + `<div class="card"><p class="muted">The recorded run of act two appears here once it has run on Diana (<code>npm run demo:session</code>).</p></div>`;
  }
  const byStep = Object.fromEntries(actTwo.steps.map((entry) => [entry.step, entry]));
  const events = actTwoStory.map(([key, title, text, tag, kind], i) => {
    const step = byStep[key];
    if (!step) return '';
    const refusedAsExpected = kind === 'refused' && step.outcome === 'refused';
    const unexpected = kind === 'refused' && step.outcome !== 'refused';
    const detail = refusedAsExpected && step.reason ? text + ' Reason from the chain: ' + step.reason + '.' : text;
    const link = step.tx ? `<a href="${explorer(step.tx)}">${shortHash(step.tx)} →</a>`
      : /^[\dA-F]{64}$/.test(step.cosmosTx ?? '') ? `<a href="${NATIVE_EXPLORER + step.cosmosTx}" target="_blank" rel="noreferrer">${step.cosmosTx.slice(0, 10)}… ↗</a>` : 'refused before inclusion';
    const meta = (step.block ? 'block ' + escape(step.block) : step.height && step.height !== '-' ? 'height ' + escape(step.height) : '') + '<br>' + link;
    return `<article class="event ${unexpected ? 'neutral' : kind ?? ''}"><span class="dot">${refusedAsExpected ? '✕' : i + 1}</span>
      <div><h3>${escape(title)}</h3><p>${escape(detail)}</p><span class="amount-tag">${escape(unexpected ? 'Not refused' : tag)}</span></div>
      <div class="meta">${meta}</div></article>`;
  }).join('');
  return intro + `<div class="timeline">${events}</div>
    <p class="small-note muted" style="margin-top:14px">Native transactions open in the QoreChain explorer: choose Testnet at the top of the explorer first. Treaty #${escape(actTwo.treaty ?? '')}, ${escape(actTwo.startedAt?.slice(0, 10) ?? '')}.</p>`;
}

export function liveHtml() {
  let n = 0;
  const phases = story.map(([phase, events]) => `<div class="phase">${escape(phase)}</div>` + events.map(([key, title, text, tag, kind]) => {
    n += 1;
    const step = key ? tx[key] : undefined;
    const meta = step
      ? `block ${escape(step.block)}<br><a href="${explorer(step.tx)}">${shortHash(step.tx)} →</a>`
      : 'simulated · nothing spent';
    return `<article class="event ${kind ?? ''}"><span class="dot">${kind === 'refused' ? '✕' : n}</span>
      <div><h3>${escape(title)}</h3><p>${escape(text)}</p><span class="amount-tag">${escape(tag)}</span></div>
      <div class="meta">${meta}</div></article>`;
  }).join('')).join('');
  return `<div class="shell page">
    <div class="intro"><p class="eyebrow">Live on QoreChain Diana · ${escape(liveFacts.date)}</p>
      <h1>One deal between AI agents, <em>replayed.</em></h1>
      <p>Four separate accounts (an owner and three agents) ran this on the real Diana testnet. Each step below links to its transaction. Treaty #1 on contract <a href="${explorer(deployment.contract.deployTx)}">${shortHash(deployment.contract.address)}</a>.</p></div>
    <div class="proof">
      <div class="stat"><strong>${demo.steps.length}/${demo.steps.length}</strong><span>transactions succeeded</span></div>
      <div class="stat"><strong>4</strong><span>Native receipts (#41 to #44)</span></div>
      <div class="stat"><strong>3</strong><span>attacks and overreaches refused</span></div>
      <div class="stat"><strong>10 → 6 + 4</strong><span>QOR locked → paid + refunded</span></div>
    </div>
    <div id="live-state"></div>
    <div class="timeline">${phases}</div>
    ${actTwoHtml()}
  </div>`;
}

/** The current state of Treaty #1, read from Diana by the page itself. */
export function liveStateHtml({ agreement, deliveries, mandate, earned, verified }) {
  const label = { Accepted: 'accepted · paid', Rejected: 'rejected', Released: 'released · paid', Pending: 'waiting' };
  return `<section class="state-grid">
    <div class="card"><span class="tag ok">Read from Diana just now</span><h2 style="margin-top:12px">Treaty #1</h2>
      <dl class="totals" style="margin-top:12px"><dt>Paid</dt><dd>${agreement.sales} of ${agreement.maxUnits} datasets</dd><dt>Refunded</dt><dd>${agreement.refundedQor} QOR</dd>
      <dt>Terms on Native</dt><dd>${verified ? 'verified ✓' : 'checking…'}</dd></dl></div>
    <div class="card"><h2>Deliveries</h2><ul class="history" style="margin-top:8px">${deliveries.map((delivery) =>
      `<li><span>Delivery ${delivery.unit}</span><span class="muted">${label[delivery.state] ?? delivery.state}</span></li>`).join('')}</ul></div>
    <div class="card"><h2>Agents</h2><ul class="history" style="margin-top:8px">
      <li><span>Research agent</span><span class="muted">${mandate.revoked ? 'switched off by its owner' : 'active'}</span></li>
      <li><span>Data agent</span><span class="muted">earned ${earned.data} QOR</span></li>
      <li><span>Cleaning agent</span><span class="muted">earned ${earned.cleaner} QOR</span></li></ul></div>
  </section>`;
}

export const liveParties = demo.parties;
