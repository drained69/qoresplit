// The soundtrack and interface sounds, synthesised from src/timeline.mjs. Nothing to license.
//
//   public/music.wav   the score: 120 BPM, calm and confident, tension for the attack, release after it
//   public/sfx.wav     clicks, typing, seals, coins, toasts and refusal thuds, at the timeline's cues
//   public/mix.wav     both, for previewing in Remotion Studio
//
// The music stays low and mostly out of the voice band (roughly 300 Hz to 3 kHz): a sub bass and a
// low pad under it, glassy bells and air above it.
import { mkdir, writeFile } from 'node:fs/promises';
import { BEAT, CUE, DURATION, FPS, SECTIONS, soundCues } from '../src/timeline.mjs';

const RATE = 48000;
const LENGTH = Math.ceil((DURATION / FPS) * RATE);
const sec = (frames) => frames / FPS;
const beatSec = BEAT / FPS; // 0.5 s

function stereo() { return [new Float32Array(LENGTH), new Float32Array(LENGTH)]; }
const music = stereo();
const sfx = stereo();

// deterministic noise
let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rand() * 2 - 1;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Add a voice: fn(t, i) returns a sample at time t (s) since its start. */
function add(bus, start, dur, fn, gain = 1, pan = 0) {
  const s0 = Math.max(0, Math.floor(start * RATE));
  const s1 = Math.min(LENGTH, Math.floor((start + dur) * RATE));
  const l = gain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
  const r = gain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
  for (let i = s0; i < s1; i++) {
    const v = fn((i - s0) / RATE, i - s0);
    bus[0][i] += v * l;
    bus[1][i] += v * r;
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const adsr = (t, dur, a, r) => Math.min(1, t / a) * Math.min(1, Math.max(0, (dur - t) / r));

// ------------------------------------------------------------------ the score
// Chords as MIDI roots with a quality. D major home key: D, Bm, G, A.
const PROG_CALM = [[50, 'maj'], [47, 'min'], [43, 'maj'], [45, 'maj']];
const PROG_DARK = [[47, 'min'], [43, 'maj'], [47, 'min'], [42, 'min']]; // Bm G Bm F#m
const PROG_TENSE = [[47, 'min'], [47, 'min'], [48, 'maj'], [47, 'min']]; // Bm Bm C Bm
const third = (q) => (q === 'min' ? 3 : 4);

function chordTones([root, q]) { return [root, root + third(q), root + 7]; }

function bass(start, dur, note, gain = 0.5) {
  const f = midi(note - 12);
  add(music, start, dur, (t) => Math.sin(2 * Math.PI * f * t) * env(t, 0.02, 0.9) * 0.9 + Math.sin(2 * Math.PI * f * 2 * t) * env(t, 0.01, 0.3) * 0.15, gain);
}
function pad(start, dur, chord, gain = 0.09) {
  const tones = chordTones(chord).map((n, i) => midi(n + (i === 0 ? 0 : -12) + 12));
  // keep the pad below ~300 Hz: root and fifth in octave 3, third in octave 3
  for (const [i, f0] of tones.entries()) {
    const f = f0 > 300 ? f0 / 2 : f0;
    for (const detune of [-0.15, 0.15]) {
      add(music, start, dur + 0.6, (t) => Math.sin(2 * Math.PI * (f + detune) * t + i) * adsr(t, dur + 0.6, 0.5, 0.8), gain / 2, detune * 2);
    }
  }
}
function bell(start, note, gainIn = 0.05, pan = 0) {
  const gain = gainIn * 2.2;
  const f = midi(note);
  add(music, start, 2.2, (t) => (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6)) * env(t, 0.004, 0.55), gain, pan);
}
function kick(start, gain = 0.45) {
  add(music, start, 0.35, (t) => Math.sin(2 * Math.PI * (45 * t + 60 * (1 - Math.exp(-t * 30)) / 30 * 1)) * env(t, 0.002, 0.12), gain);
}
function hat(start, gain = 0.03, len = 0.035) {
  let prev = 0;
  add(music, start, len + 0.01, (t) => { const n = noise(); const hp = n - prev; prev = n; return hp * env(t, 0.001, len / 3); }, gain, rand() * 0.6 - 0.3);
}
function swell(start, dur, gain = 0.05) {
  let lp = 0;
  add(music, start, dur, (t) => { const n = noise(); lp += 0.02 * (n - lp); return (n - lp) * Math.pow(t / dur, 2.2) * 0.6; }, gain);
}
function drone(start, dur, note, gain = 0.12) {
  const f = midi(note - 12);
  add(music, start, dur, (t) => (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.5 * t + 1)) * adsr(t, dur, 0.6, 0.4) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.5 * t)), gain);
}

/** One bar (4 beats) of a section's groove. */
function bar(start, chord, style, len = 4) {
  const dur = len * beatSec;
  const tones = chordTones(chord);
  const bells = [tones[0] + 48, tones[2] + 48, tones[1] + 48, tones[2] + 36];
  if (style === 'still') { pad(start, dur, chord, 0.07); bell(start, bells[0], 0.03); return; }
  if (style === 'dark') {
    pad(start, dur, chord, 0.075); bass(start, dur, tones[0], 0.32);
    for (let b = 0; b < len; b += 2) bell(start + b * beatSec, tones[2] + 48, 0.022, b ? 0.3 : -0.3);
    return;
  }
  if (style === 'tense') {
    drone(start, dur, tones[0], 0.1);
    for (let e = 0; e < len * 2; e++) bass(start + e * beatSec / 2, beatSec / 2, tones[0], 0.22);
    for (let s16 = 0; s16 < len * 4; s16++) hat(start + s16 * beatSec / 4, s16 % 4 === 2 ? 0.03 : 0.014, 0.02);
    for (let b = 0; b < len; b++) kick(start + b * beatSec, b % 2 ? 0.25 : 0.4);
    return;
  }
  // calm and confident
  pad(start, dur, chord, 0.08);
  bass(start, dur, tones[0], 0.36);
  for (let b = 0; b < len; b++) {
    if (b % 2 === 0) kick(start + b * beatSec, style === 'lift' ? 0.42 : 0.32);
    hat(start + b * beatSec + beatSec / 2, 0.022);
  }
  for (let e = 0; e < len * 2; e++) {
    if (e % 3 === 0 || (style === 'lift' && e % 2 === 1)) bell(start + e * beatSec / 2, bells[e % 4], style === 'lift' ? 0.034 : 0.026, ((e % 4) - 1.5) / 3);
  }
}

/** Fill [from, to) (frames) with bars of a progression, starting the progression at `from`. */
function region(from, to, prog, style) {
  let t = sec(from);
  const end = sec(to);
  let i = 0;
  while (t < end - 1e-6) {
    const len = Math.min(4, Math.round((end - t) / beatSec));
    bar(t, prog[i % prog.length], style, len);
    t += len * beatSec;
    i++;
  }
}

const S = Object.fromEntries(SECTIONS.map((x) => [x.id, x]));
// hook: the finished cover, the problem, the quantum threat, then "Treaty fixes both"
region(0, CUE.problemAgents - 10, PROG_CALM, 'still');
region(CUE.problemAgents - 10, CUE.quantum, PROG_DARK, 'dark');
region(CUE.quantum, CUE.fixes, PROG_TENSE.map(([n]) => [n, 'min']), 'dark');
drone(sec(CUE.quantum), sec(CUE.fixes - CUE.quantum), 47, 0.07);
swell(sec(CUE.fixes) - 1.5, 1.5, 0.05);
region(CUE.fixes, S.hook.to, PROG_CALM, 'still');
// the story: calm and confident, a new phrase at every section
for (const id of ['mandate', 'deal', 'refuse', 'work']) region(S[id].from, S[id].to, PROG_CALM, 'calm');
// the attack: tension, a hard stop at the first block, a second hit, silence, then release
region(S.attack.from, CUE.block1, PROG_TENSE, 'tense');
swell(sec(CUE.block1) - 2, 2, 0.07);
drone(sec(CUE.block1) + 0.9, sec(S.attack.to - CUE.block1) - 1.2, 47, 0.06);
// release
swell(sec(S.off.from) - 1, 1, 0.04);
region(S.off.from, S.off.to, PROG_CALM, 'lift');
region(S.proof.from, S.proof.to, [[43, 'maj'], [45, 'maj'], [50, 'maj'], [47, 'min']], 'calm');
region(S.close.from, CUE.closeIn, [[43, 'maj'], [45, 'maj'], [47, 'min'], [45, 'maj']], 'calm');
// the close: one resolving chord, ringing out
pad(sec(CUE.closeIn), sec(DURATION - CUE.closeIn), [50, 'maj'], 0.1);
bass(sec(CUE.closeIn), sec(DURATION - CUE.closeIn), 50, 0.4);
kick(sec(CUE.closeIn), 0.4);
for (const [i, n] of [98, 102, 105, 110].entries()) bell(sec(CUE.closeIn) + i * beatSec / 2, n, 0.04, (i - 1.5) / 3);

// the hard stop: silence the score around each block
function duck(from, to, floor = 0) {
  const a = Math.floor(sec(from) * RATE);
  const b = Math.floor(sec(to) * RATE);
  const ramp = Math.floor(0.012 * RATE);
  for (let i = Math.max(0, a - ramp); i < Math.min(LENGTH, b + ramp * 20); i++) {
    const g = i < a ? 1 - (i - (a - ramp)) / ramp * (1 - floor) : i < b ? floor : floor + (1 - floor) * (i - b) / (ramp * 20);
    music[0][i] *= g;
    music[1][i] *= g;
  }
}
duck(CUE.block1, CUE.block1 + 27);
duck(CUE.block2, CUE.block2 + 20, 0.2);
// fade the very end
for (let i = LENGTH - RATE; i < LENGTH; i++) { const g = (LENGTH - i) / RATE; music[0][i] *= g; music[1][i] *= g; }

// ------------------------------------------------------------------ interface sounds
const sounds = {
  key(start, gain) {
    const f = 1700 + rand() * 900;
    let prev = 0;
    add(sfx, start, 0.03, (t) => { const n = noise(); const hp = n - prev; prev = n; return (hp * 0.6 + Math.sin(2 * Math.PI * f * t) * 0.4) * env(t, 0.0005, 0.006); }, 0.16 * gain, rand() * 0.4 - 0.2);
  },
  click(start) {
    add(sfx, start, 0.06, (t) => (noise() * 0.5 * env(t, 0.0005, 0.003) + Math.sin(2 * Math.PI * 1150 * t) * env(t, 0.001, 0.012)), 0.42);
  },
  stamp(start) {
    add(sfx, start, 0.35, (t) => Math.sin(2 * Math.PI * (55 * t + 90 * (1 - Math.exp(-t * 25)) / 25)) * env(t, 0.002, 0.09), 0.75);
    let lp = 0;
    add(sfx, start, 0.08, (t) => { lp += 0.25 * (noise() - lp); return lp * env(t, 0.001, 0.02); }, 0.5);
    add(sfx, start + 0.03, 0.4, (t) => Math.sin(2 * Math.PI * 1320 * t) * env(t, 0.002, 0.09), 0.06);
  },
  coin(start) {
    for (const [d, n] of [[0, 100], [0.07, 105]]) {
      const f = midi(n);
      add(sfx, start + d, 0.6, (t) => (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.4 * t) * Math.exp(-t * 20)) * env(t, 0.001, 0.14), 0.17, d ? 0.25 : -0.25);
    }
  },
  toast(start) {
    add(sfx, start, 0.3, (t) => Math.sin(2 * Math.PI * (700 * t + 900 * t * t)) * env(t, 0.004, 0.06), 0.13);
    add(sfx, start + 0.06, 0.4, (t) => Math.sin(2 * Math.PI * midi(93) * t) * env(t, 0.002, 0.12), 0.07);
  },
  thud(start) {
    add(sfx, start, 0.9, (t) => Math.sin(2 * Math.PI * (34 * t + 60 * (1 - Math.exp(-t * 9)) / 9)) * env(t, 0.003, 0.28), 1.0);
    let lp = 0;
    add(sfx, start, 0.25, (t) => { lp += 0.04 * (noise() - lp); return lp * env(t, 0.001, 0.07) * 4; }, 0.45);
  },
  tick(start) {
    add(sfx, start, 0.08, (t) => Math.sin(2 * Math.PI * 820 * t) * env(t, 0.001, 0.018), 0.22);
  },
  whoosh(start, gain) {
    let lp = 0;
    let lp2 = 0;
    add(sfx, start, 0.45, (t) => {
      const c = 0.02 + 0.2 * Math.sin(Math.PI * t / 0.45);
      lp += c * (noise() - lp); lp2 += c * 0.5 * (lp - lp2);
      return (lp - lp2) * Math.sin(Math.PI * t / 0.45);
    }, 0.32 * gain, 0);
  },
  glitch(start, gain) {
    let hold = 0;
    add(sfx, start, 0.3, (t, i) => { if (i % 160 === 0) hold = noise(); return (Math.sin(2 * Math.PI * 180 * t) > 0 ? hold : -hold * 0.5) * (Math.floor(t * 40) % 2) * env(t, 0.005, 0.12); }, 0.16 * gain);
  },
};
for (const cue of soundCues()) sounds[cue.type](sec(cue.f), cue.gain);

// ------------------------------------------------------------------ output
function normalise(bus, peak) {
  let max = 0;
  for (const ch of bus) for (const v of ch) max = Math.max(max, Math.abs(v));
  const g = peak / max;
  for (const ch of bus) for (let i = 0; i < ch.length; i++) ch[i] *= g;
}
normalise(music, 0.2); // about -14 dBFS peak, much lower on average
normalise(sfx, 0.56);
const mix = stereo();
for (let c = 0; c < 2; c++) for (let i = 0; i < LENGTH; i++) mix[c][i] = Math.tanh((music[c][i] + sfx[c][i]) * 1.1) / 1.1;

function wav(bus) {
  const data = Buffer.alloc(44 + LENGTH * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + LENGTH * 4, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(LENGTH * 4, 40);
  for (let i = 0; i < LENGTH; i++) for (let c = 0; c < 2; c++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, bus[c][i])) * 32767), 44 + i * 4 + c * 2);
  }
  return data;
}
const dir = new URL('../public/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('music.wav', dir), wav(music));
await writeFile(new URL('sfx.wav', dir), wav(sfx));
await writeFile(new URL('mix.wav', dir), wav(mix));
console.log('music.wav, sfx.wav and mix.wav written:', (LENGTH / RATE).toFixed(2), 's,', soundCues().length, 'interface sounds');
