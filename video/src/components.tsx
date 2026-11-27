import React from 'react';
import { C, MONO, SANS, pop, ramp, window01 } from './lib';
import { CAPTIONS, SUBTITLES, TERMINAL, TOASTS, typedLength } from './timeline.mjs';

// ------------------------------------------------------------------ logo (public/favicon.svg, paper theme)
export const Mark: React.FC<{ size: number; light?: boolean; ring?: boolean }> = ({ size, light, ring }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block', flexShrink: 0 }}>
    <rect width="32" height="32" rx="8" fill={light ? C.paper : C.ink} />
    {ring && <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke="#ffffff38" />}
    <rect x="5.5" y="7.5" width="10" height="5.5" rx="2.75" fill={light ? '#7cc24a' : C.lime} />
    <rect x="16.5" y="7.5" width="10" height="5.5" rx="2.75" fill={light ? '#7cc24a' : C.lime} />
    <rect x="13.25" y="11.5" width="5.5" height="13.5" rx="2.75" fill={light ? C.ink : C.paper} />
  </svg>
);

export const Wordmark: React.FC<{ size: number; color?: string; light?: boolean }> = ({ size, color = C.ink, light }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.32 }}>
    <Mark size={size * 1.25} light={light} ring={color !== C.ink} />
    <span style={{ fontFamily: SANS, fontWeight: 650, fontSize: size, letterSpacing: '-0.03em', color, lineHeight: 1 }}>Treaty</span>
  </div>
);

// ------------------------------------------------------------------ icons
export const Check: React.FC<{ size?: number; color?: string; stroke?: number }> = ({ size = 14, color = '#fff', stroke = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block' }}><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const Cross: React.FC<{ size?: number; color?: string; stroke?: number }> = ({ size = 14, color = '#fff', stroke = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block' }}><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" /></svg>
);
export const Lock: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = C.muted }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block' }}><rect x="3" y="7" width="10" height="7" rx="2" fill={color} /><path d="M5.2 7V5.2a2.8 2.8 0 015.6 0V7" fill="none" stroke={color} strokeWidth="1.6" /></svg>
);

// ------------------------------------------------------------------ browser window
export const Browser: React.FC<{
  url: string; width: number; height: number; zoom: number; narrow?: boolean; scroll?: number; children: React.ReactNode;
  overlay?: React.ReactNode; tab?: string;
}> = ({ url, width, height, zoom, narrow, scroll = 0, children, overlay, tab = 'Treaty · Binding deals between AI agents' }) => {
  const chrome = 52;
  return (
    <div style={{ position: 'absolute', inset: 0, width, height, borderRadius: 18, overflow: 'hidden', background: C.paper,
      boxShadow: '0 30px 80px #13271c26, 0 0 0 1px #13271c1f', fontFamily: SANS }}>
      <div style={{ height: chrome, background: C.paper2, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px' }}>
        <div style={{ display: 'flex', gap: 8 }}>{['#e0d9c8', '#e0d9c8', '#e0d9c8'].map((c, i) => <i key={i} style={{ width: 12, height: 12, borderRadius: 6, background: c, display: 'block' }} />)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '6px 10px', maxWidth: 220, minWidth: 0 }}>
          <Mark size={16} />
          <span style={{ fontSize: 13, color: C.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 32, background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: '0 14px', minWidth: 0 }}>
          <Lock size={13} />
          <span style={{ fontFamily: MONO, fontSize: 14, color: C.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', top: chrome, left: 0, width, height: height - chrome, overflow: 'hidden' }}>
        <div className={'app' + (narrow ? ' narrow' : '')} style={{ zoom, width: width / zoom, minHeight: (height - chrome) / zoom, background: C.paper, transform: `translateY(${-scroll}px)` }}>
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
};

/** The site header from index.html. */
export const AppHeader: React.FC<{ current?: string; wallet?: string }> = ({ current, wallet }) => (
  <header className="top" style={{ position: 'relative' }}>
    <div className="shell top-inner">
      <a className="brand"><svg className="mark" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#13271c" /><rect x="5.5" y="7.5" width="10" height="5.5" rx="2.75" fill="#a6e36e" /><rect x="16.5" y="7.5" width="10" height="5.5" rx="2.75" fill="#a6e36e" /><rect x="13.25" y="11.5" width="5.5" height="13.5" rx="2.75" fill="#fbf9f4" /></svg>Treaty</a>
      <nav>
        {[['how', 'How it works'], ['live', 'Live deal'], ['create', 'Make a treaty'], ['earnings', 'Earnings'], ['submit', 'Submit signature'], ['verify', 'Verify']].map(([id, text]) =>
          <a key={id} aria-current={current === id ? 'page' : undefined}>{text}</a>)}
      </nav>
      <div className="top-actions">
        <span className="live-dot"><i />Live on Diana</span>
        <button type="button" className="pill" style={{ fontFamily: wallet ? MONO : undefined }}>{wallet ?? 'Connect wallet'}</button>
      </div>
    </div>
  </header>
);

/** The app's success message (#status[data-kind=success]), shown as a toast. */
export const Toasts: React.FC<{ f: number; scale?: number }> = ({ f, scale = 1 }) => {
  const toast = TOASTS.filter((t) => f >= t.f && f < t.to).at(-1);
  if (!toast) return null;
  const t = window01(f, toast.f, toast.to, 12);
  const pending = Boolean((toast as { pending?: boolean }).pending);
  return (
    <div style={{ position: 'absolute', right: 22 * scale, top: 18 * scale, transform: `translateX(${(1 - ramp(f, toast.f, toast.f + 14)) * 60}px)`, opacity: t,
      background: pending ? C.card : C.greenSoft, color: pending ? C.ink2 : C.green, border: `1px solid ${pending ? C.line : '#cfe5c1'}`, borderRadius: 14 * scale, padding: `${14 * scale}px ${18 * scale}px`,
      fontFamily: SANS, fontSize: 17 * scale, fontWeight: 600, display: 'flex', gap: 10 * scale, alignItems: 'center', boxShadow: '0 16px 40px #13271c22', zIndex: 30 }}>
      {pending ? <span style={{ width: 20 * scale, height: 20 * scale, borderRadius: 99, border: `3px solid ${C.line}`, borderTopColor: C.green, transform: `rotate(${f * 18}deg)` }} />
        : <span style={{ width: 22 * scale, height: 22 * scale, borderRadius: 99, background: C.green, display: 'grid', placeItems: 'center' }}><Check size={12 * scale} /></span>}
      {toast.text}
    </div>
  );
};

// ------------------------------------------------------------------ terminal
export const Terminal: React.FC<{ f: number; width: number; height: number; fontSize: number; from?: number; to?: number; title?: string; dark?: boolean }> =
  ({ f, width, height, fontSize, from = 0, to = Infinity, title = 'agents-demo.mjs — npm run demo -- --diana' }) => {
    const lines = TERMINAL.filter((line) => line.f <= f && line.f >= from && line.f < to);
    const colour = (kind?: string) => ({ cmd: '#f4f1e8', step: C.lime, tx: '#7f9a88', ok: '#cfe9bd', bad: '#ff9b8f', dim: '#7f9a88' } as Record<string, string>)[kind ?? ''] ?? '#dfeadf';
    const last = lines.at(-1);
    // Like a real terminal: text starts at the top, and scrolls once it fills the window.
    const perRow = Math.max(20, Math.floor((width - fontSize * 2) / (fontSize * 0.6)));
    const rows = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.text.length / perRow)) + (line.kind === 'step' ? 0.5 : 0), 0);
    const fits = rows * fontSize * 1.42 < height - 40 - fontSize * 2;
    const cursorOn = Math.floor(f / 15) % 2 === 0;
    return (
      <div style={{ width, height, borderRadius: 16, overflow: 'hidden', background: '#0c1d14', boxShadow: '0 30px 70px #0b1a1255, 0 0 0 1px #ffffff14', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: '#10241a', borderBottom: '1px solid #ffffff12' }}>
          <div style={{ display: 'flex', gap: 7 }}>{[0, 1, 2].map((i) => <i key={i} style={{ width: 11, height: 11, borderRadius: 6, background: '#2b4033', display: 'block' }} />)}</div>
          <span style={{ fontFamily: MONO, fontSize: 13, color: '#9fb3a6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: fits ? 'flex-start' : 'flex-end', overflow: 'hidden', padding: `12px ${fontSize}px ${fontSize * 0.8}px` }}>
          {lines.map((line, i) => {
            const n = typedLength(line, f);
            const isLast = line === last;
            const blankBefore = line.kind === 'step' && i > 0;
            return (
              <div key={line.f + line.text} style={{ fontFamily: MONO, fontSize, lineHeight: 1.42, color: colour(line.kind), whiteSpace: 'pre-wrap',
                wordBreak: line.kind === 'tx' ? 'break-all' : 'normal', marginTop: blankBefore ? fontSize * 0.7 : 0, fontWeight: line.kind === 'step' || line.kind === 'bad' ? 600 : 400 }}>
                {line.kind === 'cmd' && <span style={{ color: C.lime }}>~/treaty $ </span>}
                {line.text.slice(0, n)}
                {isLast && (n < line.text.length || cursorOn) && <span style={{ display: 'inline-block', width: fontSize * 0.55, height: fontSize * 1.05, background: C.lime, verticalAlign: 'text-bottom', marginLeft: 2 }} />}
              </div>
            );
          })}
          {!lines.length && <div style={{ fontFamily: MONO, fontSize, color: C.lime }}>~/treaty $ <span style={{ display: 'inline-block', width: fontSize * 0.55, height: fontSize * 1.05, background: cursorOn ? C.lime : 'transparent', verticalAlign: 'text-bottom' }} /></div>}
        </div>
      </div>
    );
  };

// ------------------------------------------------------------------ cursor, anchored at a target
/** A cursor that glides to (0,0) of its parent from `fromX/fromY`, clicks at `click`, and drifts off. */
export const Cursor: React.FC<{ f: number; arrive: number; click: number; leave?: number; fromX?: number; fromY?: number; size?: number }> =
  ({ f, arrive, click, leave = click + 40, fromX = 260, fromY = 180, size = 30 }) => {
    if (f < arrive - 2 || f > leave + 14) return null;
    const t = ramp(f, arrive, click - 4, 'smooth');
    const away = ramp(f, leave, leave + 14, 'smooth');
    const x = fromX * (1 - t) + away * 120;
    const y = fromY * (1 - t) + away * 90;
    const press = f >= click && f < click + 5 ? 0.86 : 1;
    const ripple = ramp(f, click, click + 22, 'out');
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, zIndex: 50, pointerEvents: 'none', opacity: 1 - away }}>
        {f >= click && f < click + 24 && <div style={{ position: 'absolute', left: -40 * ripple - 6, top: -40 * ripple - 6, width: 80 * ripple + 12, height: 80 * ripple + 12, borderRadius: 999,
          border: `3px solid ${C.green}`, background: '#a6e36e40', opacity: 1 - ripple }} />}
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: x - 3, top: y - 2, transform: `scale(${press})`, transformOrigin: '3px 2px', filter: 'drop-shadow(0 3px 5px #0004)' }}>
          <path d="M3 2l15.5 9.2-6.6 1.4 3.9 7.3-3 1.6-3.9-7.3L4 18.3z" fill={C.ink} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    );
  };

// ------------------------------------------------------------------ a post-quantum seal
export const Seal: React.FC<{ f: number; at: number; who: string; size?: number; tone?: 'ok' | 'bad' }> = ({ f, at, who, size = 1, tone = 'ok' }) => {
  if (f < at) return null;
  const { opacity, scale } = pop(f, at, 12);
  const ok = tone === 'ok';
  return (
    <div style={{ opacity, transform: `scale(${scale * (1 + 0.5 * (1 - ramp(f, at, at + 6)))}) rotate(-3deg)`, display: 'inline-flex', alignItems: 'center', gap: 12 * size,
      background: ok ? C.lime : C.bad, color: ok ? '#17330b' : '#fff', borderRadius: 14 * size, padding: `${10 * size}px ${16 * size}px`, boxShadow: '0 14px 30px #13271c33', fontFamily: MONO, whiteSpace: 'nowrap' }}>
      <span style={{ width: 28 * size, height: 28 * size, borderRadius: 99, background: ok ? C.ink : '#ffffff30', display: 'grid', placeItems: 'center' }}>
        {ok ? <Check size={15 * size} color={C.lime} /> : <Cross size={15 * size} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 * size }}>
        <b style={{ fontSize: 17 * size, fontWeight: 600, fontFamily: SANS }}>{who}</b>
        <small style={{ fontSize: 13 * size, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'inherit', opacity: 0.85 }}>{ok ? 'ML-DSA-87 · pqcVerify ✓' : 'refused on chain'}</small>
      </span>
    </div>
  );
};

// ------------------------------------------------------------------ captions and subtitles
export const Caption: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical }) => {
  const caption = CAPTIONS.find((c) => f >= c.from && f < c.to);
  if (!caption) return null;
  const dark = Boolean((caption as { dark?: boolean }).dark);
  const enter = ramp(f, caption.from, caption.from + 18);
  const exit = ramp(f, caption.to - 10, caption.to);
  const shift = (1 - enter) * 30 - exit * 20;
  const o = enter * (1 - exit);
  const head = vertical ? 62 : 58;
  const fg = dark ? C.paper : C.ink;
  return (
    <div style={{ position: 'absolute', ...(vertical ? { left: 70, top: 120, width: 940 } : { left: 96, top: 0, bottom: 150, width: 540, display: 'flex', flexDirection: 'column', justifyContent: 'center' }), fontFamily: SANS, color: fg }}>
      <div style={{ opacity: o, transform: `translateY(${shift}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontSize: vertical ? 26 : 22, letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? '#ffb4aa' : C.green }}>
          <b style={{ fontWeight: 500, background: dark ? '#9b2f2540' : C.greenSoft, padding: '6px 12px', borderRadius: 10, color: dark ? '#ffb4aa' : C.green }}>{caption.n}</b>
          {caption.label}
          <span style={{ width: 60 * ramp(f, caption.from + 6, caption.from + 30), height: 2, background: dark ? '#ffffff40' : C.line2 }} />
        </div>
        <h2 style={{ margin: `${vertical ? 26 : 24}px 0 0`, fontSize: head, lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 600 }}>{caption.head}</h2>
        <p style={{ margin: `${vertical ? 22 : 22}px 0 0`, fontSize: vertical ? 32 : 27, lineHeight: 1.42, color: dark ? '#c9d6cd' : C.ink2, opacity: ramp(f, caption.from + 8, caption.from + 26) }}>{caption.line}</p>
      </div>
    </div>
  );
};

export const Subtitles: React.FC<{ f: number; vertical: boolean }> = ({ f, vertical }) => {
  const line = (SUBTITLES as Array<[number, number, string]>).find(([a, b]) => f >= a && f < b);
  if (!line) return null;
  const [a, b, text] = line;
  const o = window01(f, a, b, 5);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, ...(vertical ? { top: 1690 } : { bottom: 44 }), display: 'flex', justifyContent: 'center', opacity: o, zIndex: 100 }}>
      <span style={{ maxWidth: vertical ? 960 : 1500, textAlign: 'center', background: '#13271ce8', color: C.paper, fontFamily: SANS, fontWeight: 500,
        fontSize: vertical ? 44 : 38, lineHeight: 1.3, padding: vertical ? '14px 26px' : '12px 26px', borderRadius: 16, letterSpacing: '-0.01em' }}>{text}</span>
    </div>
  );
};
