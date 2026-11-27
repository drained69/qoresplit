import React from 'react';
import { Check, Mark } from '../components';
import { C, MONO, SANS, pop, ramp } from '../lib';
import { CUE, DURATION } from '../timeline.mjs';
import { HeroPanel } from './Hook';

// story.js, "Built for the track"
const reqs = [
  ['Scoped EVM window', 'Transaction, value, time, target', 'Each agent opens its own window, signed with its post-quantum key: it can only call the Treaty contract, at most 30 transactions, a capped value, for about an hour. The chain refuses anything else.'],
  ['Spending rules on chain', 'Owner mandate', 'Limits per deal, in total and in time, checked by the contract when the agent agrees and again when money is locked. An off switch, after which only the owner can move the agent’s money.'],
  ['Authenticated messaging', 'QoreSign · ML-DSA-87', 'Every message an agent sends (accept these terms, here is my work, I accept it, pay me) is a readable message signed with ML-DSA-87 and verified by the contract with QoreChain’s pqcVerify.'],
  ['Cross-VM receipts', 'EVM → Native, atomically', 'Every agreement and payment also writes a receipt on QoreChain Native in the same transaction, through the governance-approved bridge. If either side fails, both are undone.'],
];

export const Requirements: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical: v }) => {
  const t = Math.min(ramp(f, CUE.reqsIn, CUE.reqsIn + 16), 1 - ramp(f, CUE.closeIn - 12, CUE.closeIn));
  if (t <= 0) return null;
  const k = v ? 1.1 : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: t, fontFamily: SANS, color: C.ink, padding: v ? '120px 60px 0' : '80px 110px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontSize: 22 * k, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.green }}>
        <b style={{ fontWeight: 500, background: C.greenSoft, padding: '6px 12px', borderRadius: 10 }}>06</b>Built for the track</div>
      <h2 style={{ margin: '22px 0 0', fontSize: v ? 66 : 62, lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 600 }}>
        What the <span style={{ color: C.green }}>Post-Quantum AI Agents</span> track asks for.</h2>
      <div style={{ marginTop: v ? 40 : 34, background: C.card, border: `1px solid ${C.line}`, borderRadius: 26, overflow: 'hidden', boxShadow: '0 20px 60px #13271c12' }}>
        {reqs.map(([title, small, text], i) => {
          const at = CUE.reqsIn + 14 + i * 22;
          const p = pop(f, at + 8, 12);
          return (
            <div key={title} style={{ display: 'grid', gridTemplateColumns: v ? '56px 1fr' : '60px 330px 1fr', gap: v ? 18 : 26, alignItems: 'start', padding: v ? '24px 28px' : '22px 30px',
              borderTop: i ? `1px solid ${C.line}` : 'none', opacity: ramp(f, at, at + 12), transform: `translateX(${(1 - ramp(f, at, at + 14)) * 30}px)` }}>
              <span style={{ width: 44, height: 44, borderRadius: 99, background: C.green, display: 'grid', placeItems: 'center', transform: `scale(${p.scale})`, opacity: p.opacity, marginTop: 2 }}><Check size={22} /></span>
              <div>
                <div style={{ fontSize: 28 * k, fontWeight: 600, letterSpacing: '-0.02em' }}>{title}</div>
                <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 15 * k, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green }}>{small}</div>
                {v && <div style={{ marginTop: 10, fontSize: 23, lineHeight: 1.45, color: C.ink2 }}>{text}</div>}
              </div>
              {!v && <div style={{ fontSize: 22, lineHeight: 1.5, color: C.ink2 }}>{text}</div>}
            </div>);
        })}
      </div>
      <div style={{ marginTop: 26, display: 'flex', justifyContent: v ? 'center' : 'flex-end' }}>
        <span style={{ transform: `rotate(-3deg) scale(${pop(f, CUE.reqsIn + 130, 14).scale})`, opacity: pop(f, CUE.reqsIn + 130, 14).opacity, background: C.lime, color: '#17330b', fontFamily: MONO,
          fontSize: 24 * k, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '14px 22px', borderRadius: 14, boxShadow: '0 14px 30px #13271c33' }}>All post-quantum · ML-DSA-87</span>
      </div>
    </div>
  );
};

export const Close: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical: v }) => {
  const t = ramp(f, CUE.closeIn, CUE.closeIn + 18);
  if (t <= 0) return null;
  const fadeOut = ramp(f, DURATION - 8, DURATION);
  const p = pop(f, CUE.closeIn + 4, 18);
  const line = (at: number) => ({ opacity: ramp(f, at, at + 14), transform: `translateY(${(1 - ramp(f, at, at + 14)) * 20}px)` });
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: t * (1 - fadeOut) }}>
      <HeroPanel>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: SANS, color: C.paper, padding: '0 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, transform: `scale(${p.scale})`, opacity: p.opacity }}>
            <Mark size={v ? 120 : 104} ring />
            <span style={{ fontSize: v ? 120 : 108, fontWeight: 650, letterSpacing: '-0.03em' }}>Treaty</span>
          </div>
          <div style={{ marginTop: v ? 46 : 34, fontSize: v ? 84 : 76, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, color: C.lime, ...line(CUE.closeIn + 14) }}>Binding agent deals</div>
          <div style={{ marginTop: 22, fontSize: v ? 36 : 32, color: '#d9e3dc', ...line(CUE.closeIn + 24) }}>Binding deals between AI agents. Safe after Q-Day.</div>
          <div style={{ marginTop: v ? 80 : 60, display: 'flex', flexDirection: v ? 'column' : 'row', gap: v ? 18 : 16, alignItems: 'center', ...line(CUE.closeIn + 36) }}>
            <span style={{ background: C.paper, color: C.ink, borderRadius: 99, padding: '16px 28px', fontSize: v ? 34 : 30, fontWeight: 600 }}>Try it live: treaty-rust.vercel.app</span>
            {!v && <span style={{ color: '#9fb3a6', fontSize: 30 }}>·</span>}
            <span style={{ border: '1.5px solid #ffffff40', borderRadius: 99, padding: '16px 28px', fontSize: v ? 30 : 28, fontFamily: MONO }}>Code: github.com/drained69/qoresplit</span>
          </div>
          <div style={{ marginTop: v ? 70 : 50, fontFamily: MONO, fontSize: v ? 34 : 30, letterSpacing: '0.06em', color: C.lime, ...line(CUE.closeIn + 50) }}>#BuildBeforeQDay</div>
          <div style={{ position: 'absolute', top: v ? 200 : 64, fontFamily: MONO, fontSize: v ? 20 : 17, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9fb3a6', ...line(CUE.closeIn + 60) }}>
            Live on QoreChain Diana · Post-Quantum AI Agents</div>
        </div>
      </HeroPanel>
    </div>
  );
};
