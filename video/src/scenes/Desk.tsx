import React from 'react';
import { Browser, AppHeader, Cursor, Seal, Terminal, Toasts, Cross } from '../components';
import { C, MONO, SANS, count, keys, pop, qor, ramp, window01 } from '../lib';
import { ADDR, QorexSheet, StatementPage, TreatyPage, short, type Delivery, type TreatyState } from '../pages';
import { CUE, TERMINAL_SHOWN, s } from '../timeline.mjs';

export type Geo = ReturnType<typeof geometry>;
export const geometry = (vertical: boolean) => vertical
  ? { vertical, stage: { x: 40, y: 545, w: 1000, h: 1100 }, zoom: 1.42, narrow: true, term: { x: 0, y: 790, w: 1000, h: 310, font: 22 }, ui: 1.25 }
  : { vertical, stage: { x: 690, y: 56, w: 1170, h: 840 }, zoom: 1.3, narrow: false, term: { x: 0, y: 600, w: 1170, h: 240, font: 20 }, ui: 1 };

const host = 'treaty-rust.vercel.app/';
const shortC = '0xDfc61e…7D0a6'.replace('7D0a6', 'D0a6');
const URL = {
  research: host + '#statement/' + shortC + '/' + short(ADDR.research),
  treaty: host + '#agreement/' + shortC + '/1',
  data: host + '#statement/' + shortC + '/' + short(ADDR.data),
};

/** Camera: keyframes [frame, cx, cy, zoom] with cx, cy as fractions of the stage. */
function camera(f: number, frames: Array<[number, number, number, number]>, w: number, h: number) {
  const cx = keys(f, frames.map(([k, x]) => [k, x]));
  const cy = keys(f, frames.map(([k, , y]) => [k, y]));
  const z = keys(f, frames.map(([k, , , zz]) => [k, zz]));
  return `translate(${w / 2 - cx * w * z}px, ${h / 2 - cy * h * z}px) scale(${z})`;
}

type Seg = { zoom?: number; url: string; page: React.ReactNode; scroll: number; cam: Array<[number, number, number, number]>; overlay?: React.ReactNode; inner?: React.ReactNode; wallet?: string; current?: string };

function segment(f: number, g: Geo): Seg {
  const v = g.vertical;
  // ------------------------------------------------ 1. the owner's limits
  if (f < s(45)) {
    const mandateIn = ramp(f, 1066, 1090);
    return {
      url: URL.research, current: 'earnings',
      scroll: keys(f, [[1062, 0], [1100, v ? 470 : 395]]),
      page: <StatementPage who={ADDR.research} available="0 QOR" earned="0 QOR" withdrawn="0 QOR" withdrawals={0}
        mandate={f >= 1066 ? { off: false, committed: '0 QOR', enter: mandateIn, flash: window01(f, 1086, 1150, 12) } : undefined} />,
      cam: v
        ? [[CUE.browserIn, 0.5, 0.5, 1], [1150, 0.5, 0.5, 1], [1200, 0.5, 0.45, 1.08], [1320, 0.5, 0.46, 1.1], [1350, 0.5, 0.5, 1]]
        : [[CUE.browserIn, 0.5, 0.5, 1], [1150, 0.5, 0.5, 1], [1200, 0.38, 0.5, 1.42], [1320, 0.38, 0.52, 1.46], [1350, 0.5, 0.5, 1]],
      overlay: (
        <div style={{ position: 'absolute', inset: 0, paddingTop: v ? 260 : 170, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 * g.ui,
          background: `rgba(251,249,244,${0.78 * ramp(f, CUE.agentSeal - 24, CUE.agentSeal - 8)})`, opacity: 1 - ramp(f, 1062, 1074), pointerEvents: 'none' }}>
          {f >= CUE.agentSeal - 20 && <div style={{ fontFamily: MONO, fontSize: 16 * g.ui, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green,
            background: C.card, padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.line}`, opacity: ramp(f, CUE.agentSeal - 20, CUE.agentSeal - 5) }}>setMandate · two ML-DSA-87 signatures</div>}
          <Seal f={f} at={CUE.agentSeal} who="Research agent agrees" size={1.25 * g.ui} />
          <Seal f={f} at={CUE.ownerSeal} who="Olivia, its owner, agrees" size={1.25 * g.ui} />
        </div>
      ),
    };
  }
  // ------------------------------------------------ 2-4. propose, sign, lock
  if (f < s(65)) {
    const signed = f >= CUE.sign3 ? 3 : f >= CUE.sign2 ? 2 : f >= CUE.sign1 ? 1 : 0;
    const signAt = [CUE.sign1, CUE.sign2, CUE.sign3];
    const lastSign = signAt[signed - 1];
    const phase: TreatyState['phase'] = f >= CUE.locked ? 'locked' : f >= CUE.liveToast ? 'awaitBudget' : 'pending';
    const who = ['Data agent', 'Cleaning agent', 'Research agent'];
    const st: TreatyState = {
      phase, signed, paid: 0, waiting: 0, deliveries: [],
      flashRow: signed - 1, flash: lastSign ? 1 - ramp(f, lastSign, lastSign + 40) : 0,
      tagFlash: phase === 'locked' ? 1 - ramp(f, CUE.locked, CUE.locked + 45) : phase === 'awaitBudget' ? 1 - ramp(f, CUE.liveToast, CUE.liveToast + 40) : (lastSign ? 1 - ramp(f, lastSign, lastSign + 30) : 0),
      budget: phase === 'locked' ? qor(count(f, CUE.locked, CUE.locked + 30, 0, 10)) : undefined,
      rowExtra: (i) => f >= signAt[i] && f < signAt[i] + 70 ? (
        <div style={{ position: 'absolute', right: 90, top: '50%', transform: 'translateY(-50%)', opacity: 1 - ramp(f, signAt[i] + 55, signAt[i] + 70) }}>
          <Seal f={f} at={signAt[i]} who={who[i]} size={0.8} /></div>) : null,
    };
    // the signatures card is below the main card: scroll to it while signing, back up for the budget
    const scroll = v
      ? keys(f, [[1440, 0], [1468, 330], [1700, 330], [1730, 0]])
      : keys(f, [[1440, 0], [1468, 250], [1690, 250], [1725, 0]]);
    return {
      url: URL.treaty, scroll, page: <TreatyPage s={st} />,
      cam: v
        ? [[1350, 0.5, 0.5, 1], [1440, 0.5, 0.5, 1], [1470, 0.5, 0.5, 1.06], [1690, 0.5, 0.5, 1.06], [1730, 0.5, 0.5, 1], [1770, 0.5, 0.5, 1], [1930, 0.5, 0.5, 1], [1950, 0.5, 0.5, 1]]
        : [[1350, 0.5, 0.5, 1], [1440, 0.5, 0.5, 1], [1470, 0.33, 0.56, 1.3], [1690, 0.33, 0.56, 1.3], [1730, 0.5, 0.5, 1], [1770, 0.38, 0.45, 1.35], [1930, 0.38, 0.45, 1.4], [1950, 0.5, 0.5, 1]],
    };
  }
  // ------------------------------------------------ the refused second treaty
  if (f < s(80)) {
    return {
      url: URL.research, current: 'earnings', scroll: v ? 470 : 395,
      page: <StatementPage who={ADDR.research} available="0 QOR" earned="0 QOR" withdrawn="0 QOR" withdrawals={0} payingFor
        mandate={{ off: false, committed: '10 QOR' }} />,
      cam: [[1950, 0.5, 0.5, 1]],
      overlay: <LimitMeter f={f} g={g} />,
    };
  }
  // ------------------------------------------------ 5. deliveries
  if (f < s(105)) {
    const d: Delivery[] = [];
    const glow = (at: number) => window01(f, at + 6, at + 90, 12);
    const chips = (at: number) => f >= at && f < at + 86 ? (
      <span style={{ marginLeft: 'auto', marginRight: 14, display: 'flex', gap: 8, opacity: 1 - ramp(f, at + 70, at + 86) }}>
        {[['+1.6 QOR', 'data agent', 0], ['+0.4 QOR', 'cleaner', 8]].map(([amount, who, delay]) => {
          const p = pop(f, at + (delay as number), 12);
          return <span key={who as string} style={{ opacity: p.opacity, transform: `scale(${p.scale})`, background: C.lime, color: '#17330b', borderRadius: 10, padding: '5px 9px',
            fontFamily: MONO, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 8px 18px #13271c33' }}>{amount as string} <small style={{ display: 'inline', color: '#2f5d14', fontSize: 11 }}>{who as string}</small></span>;
        })}
      </span>) : null;
    if (f >= CUE.deliver0) d.push({ unit: 0, state: f >= CUE.accept0 ? 'Accepted' : 'Pending', note: f >= CUE.accept0 ? undefined : 'Review until 7:57 PM',
      hashGlow: glow(CUE.deliver0), enter: ramp(f, CUE.deliver0, CUE.deliver0 + 10), flash: f >= CUE.accept0 ? 1 - ramp(f, CUE.accept0, CUE.accept0 + 40) : 0 });
    if (f >= CUE.deliver1) d.push({ unit: 1, state: f >= CUE.reject1 ? 'Rejected' : 'Pending', note: f >= CUE.reject1 ? undefined : 'Review until 7:57 PM',
      enter: ramp(f, CUE.deliver1, CUE.deliver1 + 10) });
    if (f >= CUE.deliver2) {
      const over = f >= CUE.reviewOver;
      d.push({ unit: 2, state: f >= CUE.released ? 'Released' : 'Pending', note: f >= CUE.released ? undefined : over ? 'Review period over' : 'Review until 7:58 PM',
        enter: ramp(f, CUE.deliver2, CUE.deliver2 + 10), flash: f >= CUE.released ? 1 - ramp(f, CUE.released, CUE.released + 40) : 0,
        release: over && f < CUE.released + 2 ? <span style={{ position: 'relative', display: 'inline-block' }}>
          <button className="secondary small" type="button" style={{ opacity: ramp(f, CUE.reviewOver, CUE.reviewOver + 10) }}>Release payment</button>
          <span style={{ position: 'absolute', left: '60%', top: '60%' }}><Cursor f={f} arrive={CUE.reviewOver + 12} click={CUE.releaseClick} fromX={-260} fromY={160} size={26} /></span></span> : null });
    }
    const paid = (f >= CUE.accept0 ? 1 : 0) + (f >= CUE.released ? 1 : 0);
    const waiting = d.filter((x) => x.state === 'Pending').length;
    const payments: NonNullable<TreatyState['payments']> = [];
    if (f >= CUE.accept0) payments.push({ unit: 0, how: 'accepted', receipt: 42, enter: ramp(f, CUE.accept0, CUE.accept0 + 10), chips: chips(CUE.accept0) });
    if (f >= CUE.released) payments.push({ unit: 2, how: 'released', receipt: 43, enter: ramp(f, CUE.released, CUE.released + 10), chips: chips(CUE.released) });
    // review period clock for the ignored delivery
    const clock = f >= CUE.deliver2 + 40 && f < CUE.reviewOver + 10 ? (
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 13, color: C.warn, background: C.warnBg, borderRadius: 12, padding: '8px 12px',
        opacity: window01(f, CUE.deliver2 + 40, CUE.reviewOver + 10, 8) }}>
        <span>The client is busy · review period</span>
        <span style={{ flex: 1, height: 6, borderRadius: 6, background: '#ecd9ae', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${100 * ramp(f, CUE.deliver2 + 45, CUE.reviewOver, 'linear')}%`, background: C.warn }} /></span>
        <b>{Math.round(60 * (1 - ramp(f, CUE.deliver2 + 45, CUE.reviewOver, 'linear')))} s</b>
      </div>) : null;
    const st: TreatyState = { phase: 'locked', signed: 3, paid, waiting, deliveries: d, payments, hideSigners: true, hideBreakdown: true, wide: true, ledgerExtra: clock };
    return {
      url: URL.treaty, zoom: v ? 1.75 : 1.6, scroll: v ? keys(f, [[2400, 0], [2440, 760]]) : keys(f, [[2400, 0], [2436, 730]]), page: <TreatyPage s={st} />,
      cam: v
        ? [[2400, 0.5, 0.5, 1]]
        : [[2400, 0.5, 0.5, 1]],
    };
  }
  // ------------------------------------------------ 7. the off switch
  if (f < CUE.refundPage) {
    const off = f >= CUE.switchedOff;
    const sheet = f >= CUE.qorexIn && f < CUE.switchedOff + 30;
    return {
      url: URL.research, current: 'earnings', wallet: '0x8324…BEC2', scroll: v ? 470 : 395,
      page: <StatementPage who={ADDR.research} available="0 QOR" earned="0 QOR" withdrawn="0 QOR" withdrawals={0} payingFor switchedOff={off}
        mandate={{ off, committed: '10 QOR', flash: off ? 1 - ramp(f, CUE.switchedOff, CUE.switchedOff + 45) : 0,
          offButton: <span style={{ position: 'absolute', left: 180, top: 26 }}><Cursor f={f} arrive={CUE.offPage + 10} click={CUE.offClick} leave={CUE.offClick + 10} size={26} /></span> }} />,
      overlay: sheet ? (
        <QorexSheet scale={g.ui} enter={window01(f, CUE.qorexIn, CUE.switchedOff + 30, 10)} approved={f >= CUE.qorexApprove + 6 ? 1 : 0}
          text={'Treaty: owner switches off agent\n0x378c243566d8e545e3e32e8555de03403f66b998\ncontract 0xdfc61ec824205aef7f2fc80fad5dbc2cc987d0a6\nchain 9800'}
          approve={<span style={{ position: 'absolute', left: '50%', top: '60%' }}><Cursor f={f} arrive={CUE.qorexIn + 14} click={CUE.qorexApprove} leave={CUE.qorexApprove + 16} fromX={-220} fromY={140} size={26} /></span>} />
      ) : f >= CUE.notAuthorized - 2 ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: v ? 380 : 300, display: 'flex', justifyContent: 'center' }}>
          <Refusal f={f} at={CUE.notAuthorized} title="Its next acceptance: refused" code="AgentNotAuthorized" scale={g.ui} until={CUE.refundPage} />
        </div>
      ) : null,
      cam: [[3750, 0.5, 0.5, 1]],
    };
  }
  // ------------------------------------------------ 8. refund
  if (f < CUE.withdrawPage) {
    const refunded = f >= CUE.refund;
    const st: TreatyState = {
      phase: refunded ? 'settled' : 'refundable', signed: 3, paid: 3, waiting: 0, hideSigners: true, wide: true, hideBreakdown: true,
      returned: refunded ? qor(count(f, CUE.refund, CUE.refund + 30, 0, 4)) : undefined, tagFlash: 0,
      deliveries: [{ unit: 0, state: 'Accepted' }, { unit: 1, state: 'Rejected' }, { unit: 2, state: 'Released' }, { unit: 3, state: 'Released' }],
    };
    return {
      url: URL.treaty, scroll: 0, page: <TreatyPage s={st} />,
      overlay: refunded ? <div style={{ position: 'absolute', left: 0, right: 0, top: v ? 430 : 300, display: 'flex', justifyContent: 'center' }}>
        <BigAmount f={f} at={CUE.refund} amount={4} label="back to Olivia, not the agent" scale={g.ui} /></div> : null,
      cam: [[3990, 0.5, 0.5, 1]],
    };
  }
  // ------------------------------------------------ 9. withdrawals
  const left = 4.8 - count(f, CUE.withdrawData, CUE.withdrawData + 30, 0, 4.8);
  return {
    url: URL.data, current: 'earnings', scroll: 0,
    page: <StatementPage who={ADDR.data} available={qor(left)} earned="4.8 QOR" withdrawn={qor(4.8 - left)} withdrawals={f >= CUE.withdrawData ? 1 : 0} earning
      amountFlash={f >= CUE.withdrawData && f < CUE.withdrawData + 30 ? 1 : 0} />,
    overlay: <div style={{ position: 'absolute', right: v ? 30 : 40, top: v ? 300 : 120, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end' }}>
      {f >= CUE.withdrawData && <Paid f={f} at={CUE.withdrawData} text="Data agent withdrew 4.8 QOR" scale={g.ui} />}
      {f >= CUE.withdrawCleaner && <Paid f={f} at={CUE.withdrawCleaner} text="Cleaning agent withdrew 1.2 QOR" scale={g.ui} />}
    </div>,
    cam: [[4170, 0.5, 0.5, 1]],
  };
}

// ------------------------------------------------------------------ overlays
export const Refusal: React.FC<{ f: number; at: number; title: string; code: string; scale?: number; until?: number }> = ({ f, at, title, code, scale = 1, until = 1e9 }) => {
  if (f < at) return null;
  const p = pop(f, at, 10);
  const shake = f < at + 10 ? Math.sin((f - at) * 2.6) * (10 - (f - at)) * 1.4 : 0;
  return (
    <div style={{ opacity: p.opacity * (1 - ramp(f, until - 10, until)), transform: `translateX(${shake}px) scale(${p.scale * (1 + 0.25 * (1 - ramp(f, at, at + 6)))}) rotate(-2deg)`,
      display: 'flex', alignItems: 'center', gap: 18 * scale, background: C.bad, color: '#fff', padding: `${18 * scale}px ${26 * scale}px`, borderRadius: 20 * scale,
      boxShadow: '0 24px 60px #9b2f2566, 0 0 0 6px #fdecea', fontFamily: SANS }}>
      <span style={{ width: 48 * scale, height: 48 * scale, borderRadius: 99, background: '#ffffff26', display: 'grid', placeItems: 'center' }}><Cross size={24 * scale} stroke={3.2} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 * scale }}>
        <b style={{ fontSize: 26 * scale, fontWeight: 650, letterSpacing: '-0.02em' }}>{title}</b>
        <span style={{ fontFamily: MONO, fontSize: 18 * scale, letterSpacing: '0.04em', color: '#ffd9d3' }}>{code}</span>
      </span>
    </div>
  );
};

const BigAmount: React.FC<{ f: number; at: number; amount: number; label: string; scale: number }> = ({ f, at, amount, label, scale }) => {
  const p = pop(f, at, 14);
  return (
    <div style={{ opacity: p.opacity * (1 - ramp(f, CUE.withdrawPage - 10, CUE.withdrawPage)), transform: `scale(${p.scale})`, background: C.ink, color: C.paper, borderRadius: 22 * scale,
      padding: `${20 * scale}px ${30 * scale}px`, display: 'flex', alignItems: 'baseline', gap: 18 * scale, boxShadow: '0 30px 70px #13271c55' }}>
      <b style={{ fontFamily: SANS, fontSize: 64 * scale, letterSpacing: '-0.05em', fontWeight: 600, color: C.lime }}>{qor(count(f, at, at + 30, 0, amount))}</b>
      <span style={{ fontFamily: MONO, fontSize: 17 * scale, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#cfe9bd' }}>{label}</span>
    </div>
  );
};

const Paid: React.FC<{ f: number; at: number; text: string; scale: number }> = ({ f, at, text, scale }) => {
  const p = pop(f, at, 12);
  return (
    <div style={{ opacity: p.opacity, transform: `scale(${p.scale})`, background: C.lime, color: '#17330b', borderRadius: 16 * scale, padding: `${14 * scale}px ${20 * scale}px`,
      fontFamily: SANS, fontWeight: 650, fontSize: 22 * scale, boxShadow: '0 18px 40px #13271c33', display: 'flex', gap: 12 * scale, alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 14 * scale, background: C.ink, color: C.lime, borderRadius: 8, padding: '3px 8px' }}>ML-DSA-87</span>{text}
    </div>
  );
};

/** The owner's 15 QOR limit: 10 committed, another 10 would make 20. */
const LimitMeter: React.FC<{ f: number; g: Geo }> = ({ f, g }) => {
  const k = g.ui;
  const enter = ramp(f, CUE.secondDeal, CUE.secondDeal + 18);
  const extra = ramp(f, CUE.secondMeter, CUE.secondMeter + 50, 'smooth');
  const refused = f >= CUE.refused;
  const collapse = ramp(f, CUE.refused + 30, CUE.refused + 60, 'smooth');
  const w = g.vertical ? 860 : 960;
  const unit = w / 22;
  const shake = refused && f < CUE.refused + 12 ? Math.sin((f - CUE.refused) * 2.4) * (12 - (f - CUE.refused)) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `rgba(251,249,244,${0.55 * enter})`, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: g.vertical ? 60 : 24 }}>
      <div style={{ width: w + 80, background: C.card, borderRadius: 26, border: `1px solid ${C.line}`, boxShadow: '0 40px 90px #13271c33', padding: '32px 40px', opacity: enter,
        transform: `translateY(${(1 - enter) * 40}px) translateX(${shake}px)`, fontFamily: SANS, color: C.ink }}>
        <div style={{ fontFamily: MONO, fontSize: 17 * k, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.green }}>Owner’s limit · research agent</div>
        <div style={{ marginTop: 14, fontSize: 34 * k, fontWeight: 600, letterSpacing: '-0.035em' }}>Service treaty #2 · Label 5,000 images</div>
        <div style={{ marginTop: 6, fontSize: 21 * k, color: C.muted }}>1 QOR × 10 = <b style={{ color: C.ink }}>10 QOR</b> more · the data agent already signed</div>
        <div style={{ position: 'relative', marginTop: (g.vertical ? 96 : 64) * k, height: 54 * k }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: unit * 20, borderRadius: 14, background: C.paper2 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: unit * 10, borderRadius: '14px 0 0 14px', background: C.green, display: 'flex', alignItems: 'center', paddingLeft: 16, color: '#fff', fontWeight: 600, fontSize: 19 * k }}>Treaty #1 · 10 QOR</div>
          <div style={{ position: 'absolute', left: unit * 10 + 3, top: 0, height: '100%', width: Math.max(0, (unit * 10 - 3) * extra * (1 - collapse)), borderRadius: '0 14px 14px 0', overflow: 'hidden',
            background: refused ? `repeating-linear-gradient(-45deg, ${C.bad}, ${C.bad} 10px, #b8473c 10px, #b8473c 20px)` : `repeating-linear-gradient(-45deg, #c9a24d, #c9a24d 10px, #d8b76a 10px, #d8b76a 20px)`,
            display: 'flex', alignItems: 'center', paddingLeft: 16, color: '#fff', fontWeight: 600, fontSize: 19 * k, whiteSpace: 'nowrap' }}>+ 10 QOR</div>
          <div style={{ position: 'absolute', left: unit * 15 - 2, top: -38 * k, bottom: -14, width: 4, background: C.ink, borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: unit * 15 - 80, top: -70 * k, width: 160, textAlign: 'center', fontFamily: MONO, fontSize: 16 * k, fontWeight: 600 }}>LIMIT 15 QOR</div>
          <div style={{ position: 'absolute', left: unit * 20 - 60, top: 64 * k, width: 120, textAlign: 'center', fontFamily: MONO, fontSize: 15 * k, color: C.bad, opacity: extra * (1 - collapse) }}>= 20 QOR</div>
        </div>
        <div style={{ marginTop: 44 * k, minHeight: 90 * k, display: 'flex', alignItems: 'center' }}>
          {refused ? <Refusal f={f} at={CUE.refused} title="Refused on chain by the owner’s limit" code="MandateLimitExceeded" scale={0.95 * k} />
            : <span style={{ fontFamily: MONO, fontSize: 18 * k, color: C.muted, opacity: ramp(f, CUE.secondMeter + 20, CUE.secondMeter + 40) }}>Research agent signs treaty #2 with ML-DSA-87…</span>}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ the desk
export const Desk: React.FC<{ f: number; g: Geo }> = ({ f, g }) => {
  const seg = segment(f, g);
  const { stage, term } = g;
  // page switches: a quick fade
  const switches = [s(45), s(65), s(80), CUE.refundPage, CUE.withdrawPage];
  const near = switches.find((x) => f >= x && f < x + 10);
  const pageO = near ? ramp(f, near, near + 10) : 1;
  const browserIn = ramp(f, CUE.browserIn, CUE.browserIn + 26);
  // terminal: big at the start, then docked over the browser when an agent acts
  const shown = TERMINAL_SHOWN.find(([a, b]) => f >= a - 1 && f < b);
  const tVis = shown ? window01(f, shown[0], shown[1], 12) : 0;
  const hero = 1 - ramp(f, CUE.browserIn - 10, CUE.browserIn + 20, 'smooth');
  const tx = hero * ((stage.w - 1000) / 2) + (1 - hero) * term.x;
  const ty = hero * (g.vertical ? 140 : 90) + (1 - hero) * term.y;
  const tw = hero * (g.vertical ? 1000 : 1000) + (1 - hero) * term.w;
  const th = hero * (g.vertical ? 640 : 620) + (1 - hero) * term.h;
  const tf = hero * (g.vertical ? 25 : 23) + (1 - hero) * term.font;
  return (
    <div style={{ position: 'absolute', left: stage.x - 40, top: stage.y - 40, width: stage.w + 80, height: stage.h + 80 }}>
      <div style={{ position: 'absolute', left: 40, top: 40, width: stage.w, height: stage.h, borderRadius: 18, overflow: 'hidden', opacity: browserIn, boxShadow: '0 30px 80px #13271c26, 0 0 0 1px #13271c1f' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: stage.w, height: stage.h, transformOrigin: '0 0', transform: camera(f, seg.cam, stage.w, stage.h) }}>
        <div style={{ position: 'absolute', inset: 0, opacity: browserIn, transform: `translateY(${(1 - browserIn) * 60}px) scale(${0.96 + 0.04 * browserIn})` }}>
          <Browser url={seg.url} width={stage.w} height={stage.h} zoom={seg.zoom ?? g.zoom} narrow={g.narrow} scroll={seg.scroll}
            overlay={<>{seg.overlay}<Toasts f={f} scale={g.ui} /></>}>
            <AppHeader current={seg.current} wallet={seg.wallet} />
            <div style={{ opacity: pageO }}>{seg.page}</div>
          </Browser>
        </div>
      </div>
      </div>
      {tVis > 0 && (
        <div style={{ position: 'absolute', left: 40 + tx, top: 40 + ty + (1 - tVis) * 40, opacity: tVis }}>
          <Terminal f={f} width={tw} height={th} fontSize={tf} />
        </div>
      )}
    </div>
  );
};
