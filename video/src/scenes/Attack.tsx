import React from 'react';
import { Check, Cross, Terminal } from '../components';
import { C, MONO, SANS, pop, ramp } from '../lib';
import { CUE, s } from '../timeline.mjs';
import type { Geo } from './Desk';

/** 1:45–2:05 · An attacker with the data agent's classical key tries twice. Both refused: BadPqcSignature. */
export const Attack: React.FC<{ f: number; g: Geo }> = ({ f, g }) => {
  const v = g.vertical;
  const k = v ? 1.18 : 1;
  const { stage } = g;
  const enter = ramp(f, CUE.attackIn, CUE.attackIn + 20);
  const exit = ramp(f, s(125) - 14, s(125));
  const stolen = ramp(f, CUE.keyStolen, CUE.keyStolen + 14);
  const attempt = (n: 1 | 2) => {
    const start = n === 1 ? CUE.try1 : CUE.try2;
    const block = n === 1 ? CUE.block1 : CUE.block2;
    const travel = ramp(f, start, block, 'smooth');
    const blocked = f >= block;
    const fade = ramp(f, block + 18, block + 34);
    return { travel, blocked, fade, visible: f >= start && fade < 1 };
  };
  const a1 = attempt(1);
  const a2 = attempt(2);
  const gateRed = Math.max(f >= CUE.block1 ? 1 - ramp(f, CUE.block1 + 30, CUE.block1 + 60) * 0.4 : 0, f >= CUE.block2 ? 1 : 0);
  const flash = Math.max(f >= CUE.block1 ? 1 - ramp(f, CUE.block1, CUE.block1 + 10, 'linear') : 0, f >= CUE.block2 ? 1 - ramp(f, CUE.block2, CUE.block2 + 10, 'linear') : 0);
  const shake = (at: number) => (f >= at && f < at + 10 ? Math.sin((f - at) * 2.7) * (10 - (f - at)) * 1.6 : 0);
  const sx = shake(CUE.block1) + shake(CUE.block2);

  // layout inside the stage
  const W = stage.w;
  const keyBox = v ? { x: 20, y: 0, w: 960, h: 165 } : { x: 0, y: 20, w: 440, h: 210 };
  const gateBox = v ? { x: 20, y: 395, w: 960, h: 165 } : { x: W - 440, y: 20, w: 440, h: 210 };
  const termBox = v ? { x: 0, y: 830, w: 1000, h: 270 } : { x: 0, y: 545, w: W, h: 295 };

  const req = (a: ReturnType<typeof attempt>, n: 1 | 2) => {
    if (!a.visible) return null;
    const from = v ? { x: -300, y: 182 } : { x: 0, y: 262 };
    const to = v ? { x: 80, y: 182 } : { x: W / 2 - 260, y: 262 };
    const x = from.x + (to.x - from.x) * a.travel;
    const y = from.y + (to.y - from.y) * a.travel;
    const text = n === 1
      ? ['withdraw 3.2 QOR', 'earned by 0xD775…E5e9', 'to 0x0000…dEaD']
      : ['deliver unit 3 of treaty #1', 'work 0xceb138…c497 (“junk”)', 'provider 0xD775…E5e9'];
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: v ? 840 : 380, opacity: (1 - a.fade) * ramp(f, n === 1 ? CUE.try1 : CUE.try2, (n === 1 ? CUE.try1 : CUE.try2) + 8),
        transform: `translateX(${a.blocked ? -18 * ramp(f, n === 1 ? CUE.block1 : CUE.block2, (n === 1 ? CUE.block1 : CUE.block2) + 8) : 0}px)`,
        background: '#ffffff0d', border: `1.5px solid ${a.blocked ? '#ff8f80' : '#ffffff33'}`, borderRadius: 18, padding: '16px 20px', fontFamily: MONO, color: '#f4f1e8', zIndex: 5 }}>
        <div style={{ fontSize: 14 * k, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ffb4aa' }}>Attempt {n} · signed by the attacker</div>
        {text.map((line, i) => <div key={line} style={{ fontSize: (i === 0 ? 22 : 17) * k, fontWeight: i === 0 ? 600 : 400, marginTop: i === 0 ? 8 : 3, fontFamily: i === 0 ? SANS : MONO }}>{line}</div>)}
        <div style={{ marginTop: 10, fontSize: 14 * k, color: '#ffb4aa' }}>ML-DSA-87 signature: from a key it made up</div>
      </div>
    );
  };

  const blockedStamp = (at: number, label: string, topY: number) => {
    if (f < at) return null;
    const p = pop(f, at, 9);
    return (
      <div style={{ position: 'absolute', left: v ? 0 : gateBox.x, right: v ? 0 : undefined, width: v ? undefined : gateBox.w, top: topY, display: 'flex', justifyContent: 'center', zIndex: 10,
        opacity: v ? 1 - ramp(f, CUE.nothingSpent - 10, CUE.nothingSpent) : 1 }}>
        <div style={{ transform: `scale(${p.scale * (1 + 0.35 * (1 - ramp(f, at, at + 5)))}) rotate(-3deg)`, opacity: p.opacity, background: C.bad, color: '#fff', borderRadius: 18, padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 0 0 6px #9b2f2555, 0 24px 60px #000a', fontFamily: SANS }}>
          <Cross size={30 * k} stroke={3.4} />
          <span><b style={{ display: 'block', fontSize: 34 * k, fontWeight: 700, letterSpacing: '-0.02em' }}>BLOCKED</b>
            <span style={{ fontFamily: MONO, fontSize: 17 * k, color: '#ffd9d3' }}>{label}</span></span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: enter * (1 - exit) }}>
      <div style={{ position: 'absolute', left: stage.x, top: stage.y, width: stage.w, height: stage.h, transform: `translateX(${sx}px)` }}>
        {/* the stolen key */}
        <div style={{ position: 'absolute', left: keyBox.x, top: keyBox.y, width: keyBox.w, height: keyBox.h, borderRadius: 24, background: '#ffffff0a', border: `1.5px solid ${stolen ? '#ff8f80' : '#ffffff22'}`,
          padding: 26, color: C.paper, fontFamily: SANS, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 15 * k, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9fb3a6' }}>Data agent’s wallet key</div>
          <div style={{ marginTop: 8, fontSize: 34 * k, fontWeight: 600, letterSpacing: '-0.03em' }}>secp256k1 private key</div>
          <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 17 * k, color: '#c9d6cd' }}>0xD775Fe…dE5e9 · earned 3.2 QOR</div>
          {stolen > 0 && <span style={{ position: 'absolute', right: 18, top: -18, background: C.bad, color: '#fff', fontFamily: MONO, fontSize: 18 * k, letterSpacing: '0.12em', padding: '8px 14px', borderRadius: 10,
            transform: `rotate(5deg) scale(${pop(f, CUE.keyStolen, 10).scale})` }}>STOLEN</span>}
        </div>
        {/* the contract's gate */}
        <div style={{ position: 'absolute', left: gateBox.x, top: gateBox.y, width: gateBox.w, height: gateBox.h, borderRadius: 24, padding: 26, fontFamily: SANS,
          background: gateRed ? `rgba(155,47,37,${0.35 * gateRed})` : '#a6e36e14', border: `2px solid ${gateRed ? '#ff8f80' : C.lime}`, color: C.paper, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 15 * k, letterSpacing: '0.12em', textTransform: 'uppercase', color: gateRed ? '#ffb4aa' : C.lime }}>Treaty contract on Diana</div>
          <div style={{ marginTop: 8, fontSize: 32 * k, fontWeight: 600, letterSpacing: '-0.03em' }}>pqcVerify · ML-DSA-87</div>
          <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 16 * k, color: '#c9d6cd' }}>against the key pqcKeyStatus holds for 0xD775…E5e9</div>
        </div>
        {/* arrow lane */}
        {!v && <div style={{ position: 'absolute', left: keyBox.w + 10, right: gateBox.w + 10, top: 125, height: 2, background: 'repeating-linear-gradient(90deg, #ffffff40 0 10px, transparent 10px 20px)', opacity: ramp(f, CUE.try1 - 20, CUE.try1) }} />}
        {req(a1, 1)}{req(a2, 2)}
        {blockedStamp(CUE.block1, 'withdraw · BadPqcSignature', v ? 578 : 252)}
        {blockedStamp(CUE.block2, 'deliver junk · BadPqcSignature', v ? 668 : 352)}
        {f >= CUE.nothingSpent && (
          <div style={{ position: 'absolute', left: v ? 20 : 0, right: v ? 20 : 0, top: v ? 600 : 462, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', opacity: ramp(f, CUE.nothingSpent, CUE.nothingSpent + 14), zIndex: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: C.lime, color: '#17330b', borderRadius: 14, padding: '12px 20px', fontSize: 25 * k, fontWeight: 650, fontFamily: SANS }}>
              <Check size={18} color="#17330b" />The data agent’s 3.2 QOR stays put</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', background: '#ffffff14', color: '#dfeadf', borderRadius: 14, padding: '12px 18px', fontSize: 17 * k, fontFamily: MONO }}>
              run against Diana as simulated calls · nothing spent</span>
          </div>
        )}
        {/* the demo's own output */}
        <div style={{ position: 'absolute', left: termBox.x, top: termBox.y }}>
          <Terminal f={f} width={termBox.w} height={termBox.h} fontSize={v ? 21 : 19} from={CUE.attackIn} to={s(125)} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: '#ff5040', opacity: flash * 0.28, mixBlendMode: 'screen', pointerEvents: 'none' }} />
    </div>
  );
};
