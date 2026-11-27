import React from 'react';
import { Check, Cross, Mark, Wordmark } from '../components';
import { C, MONO, SANS, keys, pop, ramp, window01 } from '../lib';
import { CUE, s } from '../timeline.mjs';

const grid = (alpha: string) => `linear-gradient(${alpha} 1px, transparent 1px) 0 0 / 44px 44px, linear-gradient(90deg, ${alpha} 1px, transparent 1px) 0 0 / 44px 44px`;

/** The hero "doc" card from story.js. */
export const DocCard: React.FC<{ k?: number; stamp?: number; seals?: number[]; f?: number }> = ({ k = 1, stamp = 1, seals, f = 0 }) => (
  <div style={{ position: 'relative', background: C.paper, color: C.ink, borderRadius: 22 * k, padding: 26 * k, boxShadow: '0 40px 80px #0007, 0 0 0 1px #ffffff20', transform: 'rotate(1.2deg)', fontFamily: SANS }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 * k, borderBottom: `1px dashed ${C.line2}` }}>
      <strong style={{ fontSize: 23 * k, letterSpacing: '-0.02em', fontWeight: 650 }}>Treaty #1 · Clean five datasets</strong>
      <span style={{ fontFamily: MONO, fontSize: 14 * k, color: C.muted }}>DIANA</span>
    </div>
    <div style={{ display: 'grid', gap: 11 * k, padding: `${16 * k}px 0` }}>
      {[['Client', 'Research agent'], ['Providers', 'Data agent 80% · Cleaner 20%'], ['Price', '2 QOR per dataset, up to 5'], ['Budget', '10 QOR locked in the contract'], ['Owner limits', '10 per deal · 15 total · 7 days']].map(([dt, dd]) => (
        <div key={dt} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 * k, fontSize: 19 * k }}>
          <span style={{ color: C.muted }}>{dt}</span><b style={{ fontWeight: 600 }}>{dd}</b>
        </div>))}
    </div>
    <div style={{ display: 'grid', gap: 10 * k, paddingTop: 16 * k, borderTop: `1px dashed ${C.line2}` }}>
      {['Data agent', 'Cleaning agent', 'Research agent'].map((who, i) => {
        const at = seals?.[i];
        const p = at === undefined ? { opacity: 1, scale: 1 } : pop(f, at, 12);
        return (
          <div key={who} style={{ display: 'flex', alignItems: 'center', gap: 12 * k, fontSize: 18 * k }}>
            <span style={{ width: 26 * k, height: 26 * k, borderRadius: 99, background: C.green, display: 'grid', placeItems: 'center', opacity: p.opacity, transform: `scale(${p.scale})` }}><Check size={13 * k} /></span>
            {who}<small style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 14 * k, color: C.green }}>ML-DSA-87</small>
          </div>);
      })}
    </div>
    <span style={{ position: 'absolute', right: -16 * k, bottom: -20 * k, transform: `rotate(-8deg) scale(${stamp})`, opacity: Math.min(1, stamp * 2), background: C.lime, color: '#17330b', fontFamily: MONO,
      fontWeight: 500, fontSize: 16 * k, letterSpacing: '0.08em', textTransform: 'uppercase', padding: `${12 * k}px ${16 * k}px`, borderRadius: 13 * k, boxShadow: '0 10px 24px #0004' }}>3 paid · 4 QOR refunded</span>
  </div>
);

export const HeroPanel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', inset: 22, borderRadius: 34, overflow: 'hidden', background: C.forest, color: C.paper, ...style }}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(900px 600px at 78% 35%, #2f7a3e55, transparent 70%), radial-gradient(700px 500px at 0% 100%, #a6e36e22, transparent 70%), ${grid('#ffffff0a')}` }} />
    {children}
  </div>
);

const Kicker: React.FC<{ size: number; text: string; color?: string }> = ({ size, text, color = '#cfe9bd' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.7, fontFamily: MONO, fontSize: size, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>
    <i style={{ width: size * 0.5, height: size * 0.5, borderRadius: 99, background: C.lime, display: 'block' }} />{text}</span>
);

/** Frame 0 is the finished cover (the thumbnail). */
export const Cover: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical }) => {
  const drift = 1 + 0.025 * ramp(f, 0, CUE.coverOut + 10, 'linear');
  const headline = (size: number) => (
    <h1 style={{ margin: 0, fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 0.98, letterSpacing: '-0.055em' }}>
      Binding deals between AI agents. <span style={{ color: C.lime }}>Safe after Q-Day.</span></h1>
  );
  const chips = (size: number) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: size * 0.5 }}>
      {['ML-DSA-87 signatures', 'Money held by the contract', 'Owner limits & off switch', 'Stolen key gets nothing'].map((chip) =>
        <span key={chip} style={{ borderRadius: 99, padding: `${size * 0.45}px ${size * 0.8}px`, fontSize: size, fontWeight: 500, background: '#ffffff12', color: '#e6efe7', border: '1px solid #ffffff1f', fontFamily: SANS }}>{chip}</span>)}
    </div>
  );
  const attack = (k: number) => (
    <div style={{ width: 300 * k, background: '#fff', color: C.ink, borderRadius: 16 * k, padding: `${13 * k}px ${17 * k}px`, boxShadow: '0 18px 40px #0005', fontSize: 17 * k, transform: 'rotate(-2deg)', fontFamily: SANS, lineHeight: 1.35 }}>
      <b style={{ display: 'block', color: C.bad, fontFamily: MONO, fontSize: 14 * k, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 * k, fontWeight: 500 }}>Stolen key · blocked</b>
      Withdrawing without the post-quantum key: refused on chain.</div>
  );
  const foot = (size: number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: MONO, fontSize: size, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9fb3a6' }}>
      <span>Every signature post-quantum · Every payment on chain</span>{!vertical && <span>18 live transactions · 0 failed</span>}</div>
  );
  if (vertical) {
    return (
      <HeroPanel>
        <div style={{ position: 'absolute', inset: 0, padding: '84px 66px', display: 'flex', flexDirection: 'column', transform: `scale(${drift})` }}>
          <Wordmark size={54} color={C.paper} />
          <div style={{ marginTop: 70 }}><Kicker size={22} text="Live on QoreChain Diana · Build Before Q-Day" /></div>
          <div style={{ marginTop: 30 }}>{headline(104)}</div>
          <div style={{ marginTop: 70, padding: '0 22px' }}><DocCard k={1.25} /></div>
          <div style={{ marginTop: 74, display: 'flex', justifyContent: 'flex-start', paddingLeft: 10 }}>{attack(1.35)}</div>
          <div style={{ marginTop: 'auto', fontFamily: MONO, fontSize: 21, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9fb3a6', lineHeight: 1.6 }}>
            Every signature post-quantum<br />18 live transactions · 0 failed</div>
        </div>
      </HeroPanel>
    );
  }
  return (
    <HeroPanel>
      <div style={{ position: 'absolute', inset: 0, padding: '64px 96px 0', transform: `scale(${drift})` }}>
        <Wordmark size={44} color={C.paper} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.12fr 0.88fr', gap: 80, alignItems: 'center', marginTop: 70 }}>
          <div>
            <Kicker size={20} text="Live on QoreChain Diana · Build Before Q-Day" />
            <div style={{ marginTop: 30 }}>{headline(108)}</div>
            <div style={{ marginTop: 44 }}>{chips(21)}</div>
          </div>
          <div>
            <DocCard k={1.12} />
            <div style={{ marginTop: 52, marginLeft: -8 }}>{attack(1.15)}</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 96, right: 96, bottom: 30, paddingTop: 22, borderTop: '1px solid #ffffff14' }}>{foot(16)}</div>
    </HeroPanel>
  );
};

/** 0:04–0:20 · the problem. */
export const Problem: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical }) => {
  const v = vertical;
  const k = v ? 1.08 : 1;
  const intro = window01(f, CUE.problemAgents, CUE.quantum + 4, 12);
  const cardsOut = ramp(f, CUE.quantum - 8, CUE.quantum + 8);
  const cards = [
    { at: CUE.problemTrust, title: 'The paying agent trusts the other agent', text: 'to deliver after being paid, or the worker trusts the payer to pay after delivering.' },
    { at: CUE.problemTrust + 40, title: 'Someone in the middle holds the money', text: 'and everyone trusts them instead.' },
    { at: CUE.problemKey, title: 'A bot gets a private key', text: 'whose spending limits live only in its own code.' },
  ];
  const gone = ramp(f, CUE.problemGone, CUE.problemGone + 14);
  // a QOR coin flowing between two agents
  const flow = ((f - CUE.problemAgents) % 50) / 50;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: intro, fontFamily: SANS, color: C.ink }}>
      <div style={{ position: 'absolute', ...(v ? { left: 70, right: 70, top: 150 } : { left: 120, right: 120, top: 110 }), transform: `translateY(${-cardsOut * 30}px)`, opacity: 1 - cardsOut }}>
        <div style={{ fontFamily: MONO, fontSize: 22 * k, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.green, display: 'flex', alignItems: 'center', gap: 14 }}>
          <b style={{ fontWeight: 500, background: C.greenSoft, padding: '6px 12px', borderRadius: 10 }}>The problem</b></div>
        <h2 style={{ margin: '26px 0 0', fontSize: v ? 76 : 82, lineHeight: 1.02, letterSpacing: '-0.05em', fontWeight: 600, maxWidth: 1300,
          transform: `translateY(${(1 - ramp(f, CUE.problemAgents, CUE.problemAgents + 20)) * 30}px)` }}>
          AI agents are starting to <span style={{ color: C.green }}>hire and pay each other.</span></h2>
        {/* two agents and a coin */}
        <div style={{ marginTop: v ? 50 : 44, display: 'flex', alignItems: 'center', gap: 0, maxWidth: v ? 940 : 760, opacity: ramp(f, CUE.problemAgents + 10, CUE.problemAgents + 26) }}>
          {['Research agent', 'Data agent'].map((who, i) => (
            <React.Fragment key={who}>
              {i === 1 && <div style={{ position: 'relative', flex: 1, height: 3, background: C.line2, margin: '0 18px' }}>
                <span style={{ position: 'absolute', top: -15, left: `calc(${flow * 100}% - 15px)`, width: 32, height: 32, borderRadius: 99, background: C.lime, border: `2px solid ${C.limeInk}`,
                  display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.limeInk }}>QOR</span></div>}
              <span style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 20px', fontSize: 26 * k, fontWeight: 600, boxShadow: '0 10px 30px #13271c12', whiteSpace: 'nowrap' }}>{who}</span>
            </React.Fragment>))}
        </div>
        <p style={{ margin: `${v ? 60 : 46}px 0 0`, fontSize: 30 * k, color: C.muted, opacity: ramp(f, CUE.problemTrust - 14, CUE.problemTrust) }}>Today one of three things happens:</p>
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: v ? '1fr' : 'repeat(3, 1fr)', gap: v ? 18 : 22 }}>
          {cards.map((card, i) => {
            const t = ramp(f, card.at, card.at + 16);
            const red = i === 2 ? gone : 0;
            return (
              <div key={card.title} style={{ opacity: t, transform: `translateY(${(1 - t) * 30}px)`, background: red ? `rgba(253,236,234,${red})` : C.card, border: `1px solid ${red ? '#f3c9c4' : C.line}`, borderRadius: 22,
                padding: v ? '24px 28px' : '28px 30px', boxShadow: '0 14px 40px #13271c0d' }}>
                <div style={{ fontFamily: MONO, fontSize: 18 * k, color: red ? C.bad : C.green, letterSpacing: '0.1em' }}>0{i + 1}</div>
                <div style={{ marginTop: 10, fontSize: 31 * k, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15, color: red ? C.bad : C.ink }}>{card.title}</div>
                <div style={{ marginTop: 10, fontSize: 24 * k, lineHeight: 1.4, color: C.ink2 }}>{card.text}</div>
              </div>);
          })}
        </div>
        <div style={{ marginTop: v ? 36 : 30, display: 'inline-flex', alignItems: 'center', gap: 14, background: C.bad, color: '#fff', borderRadius: 16, padding: '14px 22px', fontSize: 28 * k, fontWeight: 600,
          opacity: gone, transform: `scale(${0.9 + 0.1 * gone})`, transformOrigin: 'left center' }}>
          <Cross size={20} stroke={3} />One bug, one prompt injection or one stolen key and the money is gone.</div>
      </div>
    </div>
  );
};

const Quantum: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical: v }) => {
  const t = window01(f, CUE.quantum, CUE.fixes, 12);
  if (t <= 0) return null;
  const crack = ramp(f, CUE.quantumCrack, CUE.quantumCrack + 12);
  const k = v ? 1.1 : 1;
  const half = (side: -1 | 1) => (
    <div style={{ position: 'absolute', inset: 0, clipPath: side < 0 ? 'polygon(0 0, 54% 0, 44% 50%, 52% 100%, 0 100%)' : 'polygon(54% 0, 100% 0, 100% 100%, 52% 100%, 44% 50%)',
      transform: `translate(${side * crack * 26}px, ${crack * (side < 0 ? -6 : 10)}px) rotate(${side * crack * 3}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 30, background: crack > 0.5 ? C.badBg : C.card, border: `2px solid ${crack > 0.5 ? '#f3c9c4' : C.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 44px' }}>
        <div style={{ fontFamily: MONO, fontSize: 20 * k, letterSpacing: '0.1em', textTransform: 'uppercase', color: crack > 0.5 ? C.bad : C.muted }}>Wallet key · secp256k1</div>
        <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 30 * k, color: C.ink, wordBreak: 'break-all' }}>guards the budget</div>
        <div style={{ marginTop: 18, fontSize: 64 * k, fontWeight: 600, letterSpacing: '-0.05em', color: crack > 0.5 ? C.bad : C.ink }}>10 QOR</div>
      </div>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: t, fontFamily: SANS, color: C.ink, display: 'flex', flexDirection: v ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: v ? 70 : 110, padding: v ? '0 70px' : '0 140px' }}>
      <div style={{ position: 'relative', width: v ? 700 : 560, height: v ? 330 : 360, flexShrink: 0, transform: `translateY(${(1 - ramp(f, CUE.quantum, CUE.quantum + 20)) * 40}px)` }}>
        {half(-1)}{half(1)}
        {crack > 0 && <span style={{ position: 'absolute', right: -24, top: -26, background: C.bad, color: '#fff', fontFamily: MONO, fontSize: 22 * k, padding: '10px 16px', borderRadius: 12, letterSpacing: '0.1em',
          transform: `rotate(6deg) scale(${pop(f, CUE.quantumCrack, 12).scale})` }}>Q-DAY</span>}
      </div>
      <div style={{ maxWidth: v ? 940 : 820, fontFamily: SANS }}>
        <h2 style={{ margin: 0, fontSize: v ? 66 : 70, lineHeight: 1.04, letterSpacing: '-0.05em', fontWeight: 600 }}>
          And that money is exactly what a <span style={{ color: C.bad }}>quantum computer</span> would steal.</h2>
        <p style={{ margin: '26px 0 0', fontSize: 29 * k, lineHeight: 1.45, color: C.ink2, opacity: ramp(f, CUE.quantum + 24, CUE.quantum + 44) }}>
          The keys guarding this money (secp256k1) are exactly what a large quantum computer is expected to break, and budgets and earnings that sit for months are exactly what an attacker would target.</p>
      </div>
    </div>
  );
};

/** “Treaty fixes both.” */
export const Fixes: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical: v }) => {
  const t = window01(f, CUE.fixes, s(20) + 8, 10);
  if (t <= 0) return null;
  const p = pop(f, CUE.fixes, 16);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: t, fontFamily: SANS, color: C.ink, padding: '0 80px', textAlign: 'center' }}>
      <div style={{ transform: `scale(${p.scale})` }}><Mark size={v ? 150 : 130} /></div>
      <h2 style={{ margin: '40px 0 0', fontSize: v ? 110 : 120, letterSpacing: '-0.055em', fontWeight: 600, lineHeight: 1 }}>Treaty fixes <span style={{ color: C.green }}>both.</span></h2>
      <p style={{ margin: '30px 0 0', fontSize: v ? 34 : 32, lineHeight: 1.45, color: C.ink2, maxWidth: 1100, opacity: ramp(f, CUE.fixes + 12, CUE.fixes + 30) }}>
        Agents sign the terms with post-quantum keys. The contract holds the money and pays only as agreed.</p>
    </div>
  );
};

export const Hook: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical }) => {
  const coverOut = ramp(f, CUE.coverOut, CUE.coverOut + 16, 'smooth');
  return (
    <>
      {coverOut < 1 && <div style={{ position: 'absolute', inset: 0, opacity: 1 - coverOut, transform: `scale(${1 - 0.04 * coverOut})` }}><Cover f={f} vertical={vertical} /></div>}
      {f >= CUE.problemAgents && <Problem f={f} vertical={vertical} />}
      <Quantum f={f} vertical={vertical} />
      <Fixes f={f} vertical={vertical} />
    </>
  );
};
export { keys };
