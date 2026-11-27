import React from 'react';
import { AppHeader, Browser, Check, Cursor, Mark, Toasts } from '../components';
import { C, MONO, SANS, count, keys, pop, ramp, window01 } from '../lib';
import { QorexSheet, TreatyPage, WORK, type TreatyState } from '../pages';
import { CUE, s } from '../timeline.mjs';
import demo from '../../../deployments/diana-demo.json';
import { Reenacted, type Geo } from './Desk';

// The live page (story.js liveHtml): every step of the run, each linked to its transaction.
const story: Array<[string | null, string, string, string, string?]> = [
  ['owner sets the agent’s limits', 'Olivia puts her research agent on a budget', 'At most 10 QOR per deal and 15 QOR in total, for 7 days. Both the agent and Olivia sign with ML-DSA-87.', 'Limits set'],
  ['Data agent signs the terms', 'The data agent signs the terms', '"Clean five survey datasets", 2 QOR each, up to 5. It will receive 80% of each payment.', 'Signed'],
  ['Cleaning agent signs the terms', 'The cleaning agent signs', 'It will receive 20% of each payment.', 'Signed'],
  ['Research agent signs the terms', 'The research agent signs last: the treaty is live', 'Its owner\'s limits allow this deal. The terms are also recorded on QoreChain Native.', 'Live'],
  ['the client locks the budget', 'The research agent locks 10 QOR', 'The money now sits in the contract, where the data agents can see it before they start.', '10 QOR locked'],
  ['a second treaty for the data agent', 'It tries to commit to a second 10 QOR deal', 'The data agent signs a second deal, but the research agent\'s signature is refused: 20 QOR would break Olivia\'s 15 QOR limit.', 'Refused by the owner\'s limit', 'refused'],
  ['the data agent delivers dataset 1', 'Dataset 1 is delivered', 'Only its fingerprint goes on chain. 1,200 rows, no empty values.', 'Delivered'],
  ['the client accepts it', 'The research agent checks it and accepts', 'Paid at once: 1.6 QOR to the data agent, 0.4 QOR to the cleaner, with a receipt on Native.', '+2 QOR paid'],
  ['the data agent delivers dataset 2', 'Dataset 2 is delivered', '40 rows, 312 empty values.', 'Delivered'],
  ['the client rejects it', 'The research agent rejects it', 'Nothing is paid; the unit can be delivered again.', 'Rejected · 0 paid', 'neutral'],
  ['the data agent delivers a fixed dataset', 'A fixed dataset 2 arrives', 'This time the research agent is busy and doesn\'t answer.', 'Delivered'],
  ['the cleaning agent releases the ignored delivery', 'The review period passes: anyone may release it', 'The cleaning agent does. The team is paid without waiting.', '+2 QOR paid'],
  [null, 'An attacker steals the data agent\'s wallet key', 'It tries to withdraw the data agent\'s 3.2 QOR, and to deliver junk to get paid. Both need the post-quantum key it doesn\'t have: refused by Diana with BadPqcSignature. Nothing was spent.', 'Blocked twice', 'refused'],
  ['the owner switches the agent off', 'Olivia switches her agent off', 'One post-quantum signature. The research agent can no longer sign anything in Treaty.', 'Switched off'],
  ['the data agent delivers another dataset', 'Another dataset arrives', 'The switched-off agent tries to accept it, and is refused with AgentNotAuthorized.', 'Delivered'],
  ['the cleaning agent releases the last delivery', 'Nobody reviewed it, so it is released', 'The team is paid for honest work even though the client was switched off.', '+2 QOR paid'],
  ['the unused budget goes back', 'The deadline passes: the rest goes back', '10 QOR locked, 6 QOR paid for three datasets. The unused 4 QOR goes to Olivia, not to the switched-off agent.', '4 QOR → owner'],
  ['Data agent withdraws', 'The data agent withdraws 4.8 QOR', 'Signed with its own post-quantum key.', '−4.8 QOR'],
  ['Cleaning agent withdraws', 'The cleaning agent withdraws 1.2 QOR', 'Every QOR is accounted for.', '−1.2 QOR'],
];
const tx = Object.fromEntries(demo.steps.map((step: { step: string }) => [step.step, step])) as unknown as Record<string, { tx: string; block: string; cosmosTx: string }>;
const shortHash = (hash: string) => hash.slice(0, 10) + '…' + hash.slice(-6);

const LivePage: React.FC<{ f: number }> = ({ f }) => {
  const n = Math.round(count(f, CUE.proofIn + 10, CUE.proofIn + 70, 0, 18));
  return (
    <div className="shell page" style={{ paddingTop: 30 }}>
      <div className="intro" style={{ margin: '0 0 0' }}><p className="eyebrow">Live on QoreChain Diana · 26 November 2026</p>
        <h1>One deal between AI agents, <em>replayed.</em></h1>
        <p>Four separate accounts (an owner and three agents) ran this on the real Diana testnet. Each step below links to its transaction. Treaty #1 on contract <a>0xDfc61ec8…87D0a6</a>.</p></div>
      <div className="proof" style={{ marginTop: 26 }}>
        <div className="stat"><strong>{n}/18</strong><span>transactions succeeded</span></div>
        <div className="stat"><strong>4</strong><span>Native receipts (#41 to #44)</span></div>
        <div className="stat"><strong>3</strong><span>attacks and overreaches refused</span></div>
        <div className="stat"><strong>10 → 6 + 4</strong><span>QOR locked → paid + refunded</span></div>
      </div>
      <div className="timeline">
        {story.map(([key, title, text, tag, kind], i) => {
          const step = key ? tx[key] : undefined;
          return (
            <article key={title} className={'event ' + (kind ?? '')}>
              <span className="dot">{kind === 'refused' ? '✕' : i + 1}</span>
              <div><h3>{title}</h3><p>{text}</p><span className="amount-tag">{tag}</span></div>
              <div className="meta">{step ? <>block {step.block}<br /><a>{shortHash(step.tx)} →</a></> : 'simulated · nothing spent'}</div>
            </article>);
        })}
      </div>
    </div>
  );
};

const receipts = [
  ['#41', 'Terms of treaty #1', 'Research agent signs the terms'],
  ['#42', 'Delivery 0 accepted · paid', 'the client accepts it'],
  ['#43', 'Delivery 2 released · paid', 'the cleaning agent releases the ignored delivery'],
  ['#44', 'Delivery 3 released · paid', 'the cleaning agent releases the last delivery'],
];

const Receipts: React.FC<{ f: number; k: number }> = ({ f, k }) => (
  <div style={{ width: 560 * k, background: C.ink, color: C.paper, borderRadius: 22, padding: 24 * k, boxShadow: '0 40px 90px #13271c55', fontFamily: SANS }}>
    <div style={{ fontFamily: MONO, fontSize: 14 * k, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.lime }}>EVM → Cross-VM bridge → QoreChain Native</div>
    <div style={{ marginTop: 8, fontSize: 27 * k, fontWeight: 600, letterSpacing: '-0.03em' }}>Receipts on both VMs</div>
    <div style={{ marginTop: 14, display: 'grid', gap: 10 * k }}>
      {receipts.map(([id, what, key], i) => {
        const p = pop(f, CUE.explorerRows + i * 14, 12);
        return (
          <div key={id} style={{ opacity: p.opacity, transform: `translateY(${(1 - p.opacity) * 12}px)`, display: 'grid', gridTemplateColumns: `${64 * k}px 1fr auto`, gap: 12, alignItems: 'center',
            background: '#ffffff0d', borderRadius: 14, padding: `${11 * k}px ${14 * k}px` }}>
            <b style={{ fontFamily: MONO, fontSize: 19 * k, color: C.lime }}>{id}</b>
            <span style={{ fontSize: 17 * k }}>{what}<small style={{ display: 'block', fontFamily: MONO, fontSize: 13 * k, color: '#9fb3a6', marginTop: 3 }}>explore.qore.network/tx/{tx[key].cosmosTx.slice(0, 12)}…</small></span>
            <span style={{ display: 'grid', placeItems: 'center', width: 26 * k, height: 26 * k, borderRadius: 99, background: C.green }}><Check size={13 * k} /></span>
          </div>);
      })}
    </div>
  </div>
);

export const Proof: React.FC<{ f: number; g: Geo }> = ({ f, g }) => {
  const { stage } = g;
  const v = g.vertical;
  const live = f < CUE.qorexScene;
  const enter = ramp(f, CUE.proofIn, CUE.proofIn + 18);
  const exit = ramp(f, s(165) - 12, s(165));
  const host = 'treaty-rust.vercel.app/';
  // QoreX, in the browser: accepting delivery 0 of treaty #1 (a re-enactment of the agent's signed acceptance)
  const accepted = f >= CUE.qorexDemoVerified;
  const st: TreatyState = {
    phase: 'locked', signed: 3, paid: accepted ? 1 : 0, waiting: accepted ? 0 : 1, hideSigners: true,
    deliveries: [{ unit: 0, state: accepted ? 'Accepted' : 'Pending', note: accepted ? undefined : 'Review until 7:57 PM', flash: accepted ? 1 - ramp(f, CUE.qorexDemoVerified, CUE.qorexDemoVerified + 40) : 0,
      release: accepted ? null : <span style={{ display: 'inline-flex', gap: 6 }}>
        <span style={{ position: 'relative' }}><button className="secondary small" type="button">Accept with QoreX</button>
          <span style={{ position: 'absolute', left: '55%', top: '60%' }}><Cursor f={f} arrive={CUE.qorexScene + 14} click={CUE.qorexDemoClick} leave={CUE.qorexDemoClick + 8} fromX={-300} fromY={180} size={24} /></span></span>
        <button className="secondary small" type="button">Reject with QoreX</button></span> }],
    payments: accepted ? [{ unit: 0, how: 'accepted', receipt: 42, enter: ramp(f, CUE.qorexDemoVerified + 8, CUE.qorexDemoVerified + 20) }] : [],
  };
  const sheet = f >= CUE.qorexDemoSheet && f < CUE.qorexDemoVerified + 24;
  const cam: Array<[number, number]> = live ? [[CUE.proofIn, 0], [CUE.explorerRows, 0], [CUE.qorexScene - 10, v ? 1700 : 1500]] : [[CUE.qorexScene, v ? 470 : 330]];
  const scroll = keys(f, cam);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: enter * (1 - exit) }}>
      <div style={{ position: 'absolute', left: stage.x, top: stage.y, width: stage.w, height: stage.h }}>
        <Browser url={live ? host + '#live' : host + '#agreement/0xDfc61e…D0a6/1'} width={stage.w} height={stage.h} zoom={g.zoom} narrow={g.narrow} scroll={scroll}
          overlay={<>{!live && sheet && <QorexSheet scale={g.ui} enter={window01(f, CUE.qorexDemoSheet, CUE.qorexDemoVerified + 24, 10)} approved={f >= CUE.qorexDemoApprove + 6 ? 1 : 0}
            text={'Treaty: accept delivery 0 of treaty #1\nwork ' + WORK[0] + '\ncontract 0xdfc61ec824205aef7f2fc80fad5dbc2cc987d0a6\nchain 9800'}
            approve={<span style={{ position: 'absolute', left: '50%', top: '60%' }}><Cursor f={f} arrive={CUE.qorexDemoSheet + 30} click={CUE.qorexDemoApprove} leave={CUE.qorexDemoApprove + 14} fromX={-260} fromY={170} size={26} /></span>} />}
            {!live && <Reenacted f={f} from={CUE.qorexScene + 10} to={s(165)} scale={g.ui} />}
            <Toasts f={f} scale={g.ui} /></>}>
          <AppHeader current={live ? 'live' : undefined} wallet={live ? undefined : '0x378C…b998'} />
          <div style={{ opacity: live ? 1 : ramp(f, CUE.qorexScene, CUE.qorexScene + 10) }}>{live ? <LivePage f={f} /> : <TreatyPage s={st} />}</div>
        </Browser>
        {live && f >= CUE.explorerRows - 10 && (
          <div style={{ position: 'absolute', ...(v ? { left: 20, right: 20, bottom: 20, display: 'flex', justifyContent: 'center' } : { right: -20, bottom: -10 }),
            opacity: window01(f, CUE.explorerRows - 10, CUE.qorexScene, 12), transform: `translateY(${(1 - ramp(f, CUE.explorerRows - 10, CUE.explorerRows + 8)) * 40}px)` }}>
            <Receipts f={f} k={v ? 1.55 : 1} />
          </div>
        )}
        {!live && accepted && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: v ? 60 : 50, display: 'flex', justifyContent: 'center' }}>
            <span style={{ ...pop(f, CUE.qorexDemoVerified + 10, 12) && { opacity: pop(f, CUE.qorexDemoVerified + 10, 12).opacity, transform: `scale(${pop(f, CUE.qorexDemoVerified + 10, 12).scale})` },
              background: C.greenSoft, color: C.green, border: '1px solid #cfe5c1', borderRadius: 99, padding: `${12 * g.ui}px ${22 * g.ui}px`, fontFamily: SANS, fontWeight: 650, fontSize: 22 * g.ui,
              display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 18px 40px #13271c22' }}><Mark size={24 * g.ui} />Native receipt #42 verified</span>
          </div>
        )}
      </div>
    </div>
  );
};
