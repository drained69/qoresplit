// The Treaty web app's pages, rebuilt from the HTML that src/app.js renders (same classes, same copy),
// with the values of the live run on Diana (deployments/diana-demo.json and the site screenshots).
import React from 'react';
import { C } from './lib';

export const ADDR = {
  contract: '0xDfc61ec824205AEF7f2FC80FaD5DBC2Cc987D0a6',
  olivia: '0x83247522D8f37598111CeB0B4ECC6C4C6747BEC2',
  research: '0x378C243566d8e545e3E32e8555De03403f66b998',
  data: '0xD775Fe7305B3f666620158aA1e1e9058cfedE5e9',
  cleaner: '0x9fd33a135D15282986A8E84576c0BCe2154F1854',
};
/** short() from src/chain.js */
export const short = (value: string) => value.slice(0, 8) + '…' + value.slice(-5);
export const WORK = [
  '0x7b51a8461c1cffb5ad8901620e5b2e64488e0be3b29b3b61ef251c07cfbff9f5',
  '0x12edad1fd20ddbbfab906e503bcc9252fbec8ffd27094e7a758d56a41748fad3',
  '0x0eb06f5b43e23c271fb97cf10534c7e480040abe783143a697a2543a8fe3012e',
  '0x6fec6e6f3ffba1fc0e7c6ab748a576fb58bdb62e29d8b633f5c682511975720c',
];
export const TERMS_RECEIPT = '#41 · 0xbba5f1753f21b35e712dd6a3ca1a06b465f06fe85d792d2c37582fc6d278fcea';
export const DEADLINE = 'Nov 26, 2026, 8:04 PM';

const Command: React.FC<{ text: string }> = ({ text }) => (
  <div className="command"><code>{text}</code><button className="secondary" type="button">Copy</button></div>
);
const Tag: React.FC<{ kind: 'ok' | 'warn' | 'muted'; children: React.ReactNode; style?: React.CSSProperties }> = ({ kind, children, style }) =>
  <div className={'tag ' + kind} style={style}>{children}</div>;

// ------------------------------------------------------------------ treaty page (#agreement/<contract>/1)
export type Delivery = { chips?: React.ReactNode; unit: number; state: 'Pending' | 'Accepted' | 'Rejected' | 'Released'; note?: string; flash?: number; release?: React.ReactNode; hashGlow?: number; enter?: number };
export type TreatyState = {
  phase: 'pending' | 'awaitBudget' | 'locked' | 'refundable' | 'settled';
  signed: number; flashRow?: number; flash?: number;
  paid: number; waiting: number; budget?: string; deliveries: Delivery[];
  tagFlash?: number; lockButton?: React.ReactNode; refundButton?: React.ReactNode; returned?: string;
  hideSigners?: boolean; hideBreakdown?: boolean; wide?: boolean; slot?: React.ReactNode;
  payments?: Array<{ unit: number; how: 'accepted' | 'released'; receipt: number; enter?: number; chips?: React.ReactNode }>; rowExtra?: (i: number) => React.ReactNode; ledgerExtra?: React.ReactNode;
};
const deliveryLabel = { Pending: 'Waiting for review', Accepted: 'Accepted · paid', Rejected: 'Rejected', Released: 'Released · paid' };
const signers = [
  { who: ADDR.data, role: 'Provider' }, { who: ADDR.cleaner, role: 'Provider' }, { who: ADDR.research, role: 'Client' },
];

export const TreatyPage: React.FC<{ s: TreatyState }> = ({ s }) => {
  let main: React.ReactNode;
  const pulse = (v?: number) => (v === undefined ? {} : { boxShadow: `0 0 0 ${8 * v}px #a6e36e${Math.round(0x66 * v).toString(16).padStart(2, '0')}` });
  if (s.phase === 'pending') {
    main = (
      <section className="card action">
        <Tag kind="warn" style={pulse(s.tagFlash)}>Waiting for signatures · {s.signed} of 3</Tag>
        <h2>Every party signs these terms</h2>
        <p>Send this page to every party. People sign with QoreX right here (the button next to their address) or with the Treaty signing tool; agents sign with the Treaty SDK. Every signature is ML-DSA-87, checked on chain.</p>
        <Command text="npm run pq -- sign 1" />
      </section>
    );
  } else if (s.phase === 'awaitBudget') {
    main = (
      <section className="card action">
        <Tag kind="warn" style={pulse(s.tagFlash)}>Live · waiting for the budget</Tag>
        <h2>The client locks 10 QOR</h2>
        <p>Every party signed. Work starts once the budget is in the contract, where the providers can see it. The client locks it, or its owner when the client is an agent; the owner’s limits apply.</p>
        <div style={{ position: 'relative' }}><button className="primary" type="button">Lock 10 QOR</button>{s.lockButton}</div>
        <Command text="npm run pq -- fund 1" />
      </section>
    );
  } else {
    const past = s.phase === 'refundable' || s.phase === 'settled';
    main = (
      <section className="card action">
        <Tag kind="ok" style={pulse(s.tagFlash)}>Live · budget locked</Tag>
        <h2>{s.paid} {s.paid === 1 ? 'unit' : 'units'} paid of 5</h2>
        <dl className="totals">
          <dt>Budget</dt><dd>{s.budget ?? '10 QOR'}</dd>
          <dt>Waiting for review</dt><dd>{s.waiting}</dd>
          <dt>Deadline</dt><dd>{DEADLINE}{past ? ' · passed' : ''}</dd>
          <dt>Review period</dt><dd>1 minute</dd>
          {s.returned && <><dt>Returned</dt><dd>{s.returned}</dd></>}
        </dl>
        {s.phase === 'refundable' && <><p>The deadline passed. 4 QOR of unused budget can go back now.</p><div style={{ position: 'relative' }}><button className="primary" type="button">Return 4 QOR</button>{s.refundButton}</div></>}
        {s.phase === 'settled' && <p>The deadline passed and the budget is settled.</p>}
        {s.phase === 'locked' && <><p>A provider delivers one unit; only the hash of the work goes on chain. The client accepts or rejects it within 1 minute, or it pays itself.</p>
          <Command text="npm run pq -- deliver 1 --file work.zip" /></>}
      </section>
    );
  }
  const funded = s.phase !== 'pending' && s.phase !== 'awaitBudget';
  const rows = s.deliveries.slice().reverse();
  return (
    <div className="shell page" style={{ paddingTop: 30 }}>
      <div className="intro" style={{ margin: '0 0 26px' }}><p className="eyebrow">Service treaty #1</p><h1>Clean five survey datasets</h1>
        <p>Proposed by <span>{short(ADDR.research)}</span></p></div>
      <div className="layout" style={s.wide ? { gridTemplateColumns: '1fr' } : undefined}>
        <div className="stack">
          {main}
          {s.slot}
          {s.phase !== 'pending' && <section className="card compact"><dl><dt>Terms receipt on Native</dt><dd>{TERMS_RECEIPT}</dd></dl></section>}
          {funded && (
            <section className="card ledger"><h2>Deliveries</h2>
              {rows.length ? (
                <div className="table"><table><thead><tr><th>#</th><th>Provider</th><th>Work hash</th><th>Status</th><th /></tr></thead>
                  <tbody>{rows.map((d) => (
                    <tr key={d.unit} style={{ background: d.flash ? `rgba(166,227,110,${0.35 * d.flash})` : undefined, opacity: d.enter ?? 1 }}>
                      <td>{d.unit}</td><td>{short(ADDR.data)}</td>
                      <td><code style={d.hashGlow ? { background: `rgba(166,227,110,${0.25 + 0.6 * d.hashGlow})`, color: C.ink, boxShadow: `0 0 0 ${3 * d.hashGlow}px ${C.lime}` } : undefined}>{short(WORK[d.unit])}</code></td>
                      <td style={{ position: 'relative', color: d.state === 'Rejected' ? C.bad : d.state === 'Pending' ? C.ink : C.green, fontWeight: 600 }}>{deliveryLabel[d.state]}{d.note && <small style={{ fontWeight: 400 }}>{d.note}</small>}{d.chips}</td>
                      <td style={{ position: 'relative', whiteSpace: 'nowrap' }}>{d.release}</td>
                    </tr>))}</tbody></table></div>
              ) : <p className="muted">Nothing delivered yet.</p>}
              {s.payments && s.payments.length > 0 && <div id="payments"><h3>Payments</h3><ul className="history">{s.payments.map((pay) => (
                <li key={pay.unit} style={{ opacity: pay.enter ?? 1 }}><span>Delivery {pay.unit} · {pay.how}<small>Verified on EVM and Native · receipt #{pay.receipt}</small></span>{pay.chips}<a>View</a></li>))}</ul></div>}
              {s.ledgerExtra}
            </section>
          )}
          {!s.hideSigners && (
            <section className="card signers"><div className="card-head"><h2>Signatures</h2><strong>{s.signed} / 3</strong></div>
              <ul>{signers.map((signer, i) => {
                const signed = i < s.signed;
                const flash = s.flashRow === i ? s.flash ?? 0 : 0;
                return (
                  <li key={signer.who} className={signed ? 'signed' : ''} style={{ position: 'relative', background: flash ? `rgba(166,227,110,${0.4 * flash})` : undefined, borderRadius: 10 }}>
                    <span className="check" style={{ transform: `scale(${1 + 0.5 * flash})` }}>{signed ? '✓' : ''}</span>
                    <span>{signer.who}<small>{signer.role} · {signed ? 'Signed' : 'Not signed yet'} · ML-DSA-87 key registered</small></span>
                    <a className="small-link">Statement</a>
                    {s.rowExtra?.(i)}
                  </li>);
              })}</ul>
            </section>
          )}
        </div>
        {!s.hideBreakdown && (
          <section className="card breakdown"><div className="card-head"><h2>Each accepted unit</h2><strong>2 QOR</strong></div>
            <p className="muted budget">Client <a>{short(ADDR.research)}</a> · up to 5 units · budget <strong>10 QOR</strong> · until {DEADLINE} · review 1 minute</p>
            <div className="bar"><span className="c0" style={{ ['--share' as string]: 8000 }} /><span className="c1" style={{ ['--share' as string]: 2000 }} /></div>
            <ul>
              <li><span className="swatch c0" /><span>{short(ADDR.data)}<small>80%</small></span><strong>1.6 QOR</strong></li>
              <li><span className="swatch c1" /><span>{short(ADDR.cleaner)}<small>20%</small></span><strong>0.4 QOR</strong></li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ statement page (#statement/<contract>/<address>)
export type Mandate = { off: boolean; committed: string; flash?: number; offButton?: React.ReactNode; enter?: number };
export const StatementPage: React.FC<{ who: string; available: string; earned: string; withdrawn: string; withdrawals: number;
  mandate?: Mandate; earning?: boolean; payingFor?: boolean; switchedOff?: boolean; mandateFirst?: boolean; amountFlash?: number }> = (p) => {
  const mandate = p.mandate && (
    <section className="card action" style={{ opacity: p.mandate.enter ?? 1, transform: `translateY(${(1 - (p.mandate.enter ?? 1)) * 30}px)` }}>
      <Tag kind={p.mandate.off ? 'muted' : 'ok'} style={p.mandate.flash ? { boxShadow: `0 0 0 ${8 * p.mandate.flash}px #a6e36e66` } : undefined}>
        {p.mandate.off ? 'Agent switched off by its owner' : 'Agent with an owner'}</Tag>
      <h2>Owner’s limits</h2>
      <dl className="totals"><dt>Owner</dt><dd><a>{short(ADDR.olivia)}</a></dd>
        <dt>Per treaty</dt><dd>10 QOR</dd><dt>Committed</dt><dd>{p.mandate.committed} of 15 QOR</dd>
        <dt>Until</dt><dd>Dec 3, 2026, 7:55 PM</dd></dl>
      <p>{p.mandate.off ? 'This agent can no longer sign anything here. Only its owner can move its earnings, and unused budgets go back to the owner:'
        : 'The contract refuses any treaty that would take this agent past these limits. The owner can switch it off at any time:'}</p>
      {!p.mandate.off && p.mandate.offButton !== undefined && <div style={{ position: 'relative' }}><button className="secondary" type="button">Switch off with QoreX (owner)</button>{p.mandate.offButton}</div>}
      <Command text={p.mandate.off ? 'npm run pq -- withdraw all --for ' + p.who : 'npm run pq -- revoke ' + p.who} />
    </section>
  );
  const balance = (
    <section className="card action"><div className="tag ok">Balances match the signed treaties</div>
      <h2>Available to withdraw</h2><p className="amount" style={p.amountFlash ? { color: C.green } : undefined}>{p.available}</p>
      <dl className="totals"><dt>Earned</dt><dd>{p.earned}</dd><dt>Withdrawn</dt><dd>{p.withdrawn}</dd><dt>Withdrawals</dt><dd>{p.withdrawals}</dd></dl>
      <p>{p.switchedOff ? 'This agent was switched off, so only its owner’s ML-DSA-87 signature can move these earnings.' : 'Earnings leave only with this account’s ML-DSA-87 signature. On their own computer they run:'}</p>
      <Command text={p.switchedOff ? 'npm run pq -- withdraw all --for ' + p.who : 'npm run pq -- withdraw all'} />
    </section>
  );
  return (
    <div className="shell page" style={{ paddingTop: 30 }}>
      <div className="intro" style={{ margin: '0 0 26px' }}><h1>Statement</h1><p>{p.who}</p></div>
      <div className="layout">
        <div className="stack">{p.mandateFirst ? <>{mandate}{balance}</> : <>{balance}{mandate}</>}</div>
        <div className="stack">
          <section className="card ledger"><h2>Earning from</h2>
            {p.earning ? <div className="table"><table><thead><tr><th>Treaty</th><th>Share</th><th>Paid</th><th>Earned</th></tr></thead>
              <tbody><tr><td><a>#1</a> Clean five survey datasets<small>Service · Live · every party signed</small></td><td>80%</td><td>3 × 1.6 QOR</td><td>4.8 QOR</td></tr></tbody></table></div>
              : <p className="muted">No live treaty has credited this address yet.</p>}
          </section>
          {p.payingFor && <section className="card ledger"><h2>Paying for</h2><ul className="history"><li><span>Service treaty #1</span><a>Open</a></li></ul></section>}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ the QoreX signing sheet (illustrative)
export const QorexSheet: React.FC<{ text: string; enter: number; approve?: React.ReactNode; approved?: number; scale?: number }> = ({ text, enter, approve, approved = 0, scale = 1 }) => (
  <div style={{ position: 'absolute', right: 20 * scale, top: 12 * scale, width: 430 * scale, transform: `translateY(${(1 - enter) * -40}px)`, opacity: enter, zIndex: 40,
    background: '#0c1d14', color: '#e9f1ea', borderRadius: 20 * scale, boxShadow: '0 30px 80px #0b1a1266, 0 0 0 1px #ffffff1a', fontFamily: '"Geist Variable", sans-serif', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${14 * scale}px ${18 * scale}px`, borderBottom: '1px solid #ffffff14' }}>
      <b style={{ fontSize: 17 * scale, letterSpacing: '-0.01em' }}>QoreX · Sign message</b>
      <span style={{ fontFamily: '"Geist Mono Variable", monospace', fontSize: 12 * scale, color: C.lime, letterSpacing: '0.08em' }}>QORECHAIN-DIANA</span>
    </div>
    <div style={{ padding: 18 * scale, display: 'grid', gap: 12 * scale }}>
      <span style={{ fontSize: 13 * scale, color: '#9fb3a6' }}>treaty-rust.vercel.app wants you to sign:</span>
      <pre style={{ margin: 0, background: '#ffffff0d', border: '1px solid #ffffff1a', borderRadius: 12 * scale, padding: 14 * scale, fontFamily: '"Geist Mono Variable", monospace',
        fontSize: 14 * scale, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#f4f1e8' }}>{text}</pre>
      <span style={{ fontFamily: '"Geist Mono Variable", monospace', fontSize: 12 * scale, color: '#9fb3a6', letterSpacing: '0.06em' }}>SIGNED WITH ML-DSA-87 · QORESIGN MESSAGE-SIGNING-V1</span>
      <div style={{ display: 'flex', gap: 10 * scale, justifyContent: 'flex-end' }}>
        <span style={{ padding: `${10 * scale}px ${18 * scale}px`, borderRadius: 99, border: '1px solid #ffffff30', fontWeight: 600, fontSize: 15 * scale }}>Reject</span>
        <span style={{ position: 'relative', padding: `${10 * scale}px ${20 * scale}px`, borderRadius: 99, background: approved ? C.green : C.lime, color: approved ? '#fff' : '#17330b', fontWeight: 650, fontSize: 15 * scale }}>
          {approved ? 'Signed ✓' : 'Approve'}{approve}</span>
      </div>
    </div>
  </div>
);
