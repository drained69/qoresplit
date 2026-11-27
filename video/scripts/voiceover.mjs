// The voiceover, from the same timeline as the picture.
//
//   node scripts/voiceover.mjs script
//       Writes out/voiceover/: VOICEOVER.md (every line with its time, its slot and the text to paste
//       into a text-to-speech tool such as Higgsfield), lines.csv, and full-take.txt (all lines at once).
//
//   node scripts/voiceover.mjs mix <folder-or-file> [--duck 10]
//       <folder>: one audio file per line, named by its number (01.mp3, 02.wav, "07 Olivia.mp3", …).
//                 Each clip is trimmed of leading silence and placed exactly on its line's cue.
//       <file>:   one take of the whole voiceover, already timed to the video, placed at 0:00.
//       The music is ducked under the voice (default 10 dB), the interface sounds stay, and the result is
//       muxed into out/treaty-demo-1920x1080-voiceover.mp4 and out/treaty-demo-1080x1920-voiceover.mp4
//       (the picture is copied, not re-encoded). Any clip too long for its slot is reported.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { DURATION, FPS, SECTIONS, SUBTITLES } from '../src/timeline.mjs';
import { root } from './shared.mjs';

const RATE = 48000;
const out = root + 'out/voiceover/';
const lines = SUBTITLES.map(([from, to, text], i) => {
  const next = SUBTITLES[i + 1]?.[0] ?? DURATION;
  return { n: i + 1, from, to, next, text, section: SECTIONS.find((s) => from >= s.from && from < s.to) };
});

/** How a text-to-speech voice should say Treaty's words. Change these if you prefer another reading. */
const SAY = [
  [/ML-DSA-87/g, 'M-L-D-S-A eighty-seven'],
  [/pqcVerify/g, 'P-Q-C verify'],
  [/QoreChain/g, 'Core Chain'],
  [/QoreX/g, 'Core X'],
  [/Cross-VM/g, 'cross-V-M'],
  [/\bVMs\b/g, 'V-Ms'],
  [/\bQOR\b/g, 'QOR'], // the token: say "Q-O-R" or "core" — set it here once you've decided
  [/Q-Day/g, 'Q Day'],
];
const spoken = (text) => SAY.reduce((t, [pattern, say]) => t.replace(pattern, say), text);
const time = (frames) => { const s = frames / FPS; return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
const words = (t) => t.split(/\s+/).filter(Boolean).length;

async function script() {
  await mkdir(out, { recursive: true });
  const rows = lines.map((l) => {
    const slot = (l.next - l.from) / FPS;
    return `| ${String(l.n).padStart(2, '0')} | ${time(l.from)} | ${slot.toFixed(1)} s | ${(words(l.text) / ((l.to - l.from) / FPS)).toFixed(1)} | ${l.text} | ${spoken(l.text)} |`;
  });
  const md = `# Treaty demo · voiceover script

Total length 2:59. ${lines.length} lines. Each line starts exactly at its time; it must end before the next
line's time ("slot"). The video's burned-in subtitles show the same words.

## Recording with Higgsfield (or any text-to-speech tool)

1. Open Higgsfield's Audio → Text to Speech. Pick one calm, confident voice and keep it for every line.
   Normal speed (1.0). Export WAV if offered, otherwise MP3.
2. Generate each line separately, pasting the **"Paste into TTS"** column (it spells out ML-DSA-87,
   pqcVerify and the product names so the voice says them right).
3. Name each file by its number: \`01.wav\`, \`02.wav\`, … (anything after the number is ignored) and put them
   in one folder, e.g. \`video/voice/\`.
4. Run \`node scripts/voiceover.mjs mix voice\` from \`video/\`. Every clip is trimmed and placed on its cue,
   the music dips under the voice, and you get \`out/treaty-demo-1920x1080-voiceover.mp4\` and the vertical one.
   If a clip is too long for its slot, the script says which: regenerate it a little faster (1.05–1.1).

One long take instead: paste \`full-take.txt\`, export one file, then line it up yourself and run
\`node scripts/voiceover.mjs mix take.wav\`. Per-line clips are easier, because each one lands on its cue.

## Pronunciation

| Written | Said |
| --- | --- |
${SAY.map(([p, s]) => `| ${p.source.replace(/\\b/g, '').replace(/\\/g, '')} | ${s} |`).join('\n')}

**Decide how to say "QOR"** (the token): "Q-O-R" or "core". The script leaves it as written; change the
\`QOR\` entry in \`SAY\` at the top of \`scripts/voiceover.mjs\` and re-run \`script\`.

## Lines

| # | Starts | Slot | Words/s | Subtitle | Paste into TTS |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

Words/s is the pace the line needs inside its subtitle window; 2.0–2.6 is a calm narration pace.
`;
  await writeFile(out + 'VOICEOVER.md', md);
  await writeFile(out + 'lines.csv', 'number,start_seconds,slot_seconds,subtitle,tts_text\n' + lines.map((l) =>
    [String(l.n).padStart(2, '0'), (l.from / FPS).toFixed(2), ((l.next - l.from) / FPS).toFixed(2), JSON.stringify(l.text), JSON.stringify(spoken(l.text))].join(',')).join('\n') + '\n');
  await writeFile(out + 'full-take.txt', lines.map((l) => spoken(l.text)).join('\n') + '\n');
  console.log('wrote', out + 'VOICEOVER.md, lines.csv, full-take.txt');
}

// ------------------------------------------------------------------ mixing
const ffmpeg = (args, opts = {}) => execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', ...args], { cwd: root, maxBuffer: 1 << 30, ...opts });
/** Any audio or video file → stereo 48 kHz samples (through a temporary 16-bit WAV). */
function decode(file) {
  const tmp = out + '.decode.wav';
  ffmpeg(['-y', '-i', file, '-vn', '-ac', '2', '-ar', String(RATE), '-c:a', 'pcm_s16le', tmp]);
  return parseWav(readFileSync(tmp));
}
/** A 16-bit stereo WAV, finding its data chunk past any extra chunks. */
function parseWav(data) {
  let at = 12;
  while (at < data.length - 8 && data.toString('ascii', at, at + 4) !== 'data') at += 8 + data.readUInt32LE(at + 4);
  const start = at + 8;
  const n = Math.floor((Math.min(data.length, start + data.readUInt32LE(at + 4)) - start) / 4);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = data.readInt16LE(start + i * 4) / 32768; r[i] = data.readInt16LE(start + i * 4 + 2) / 32768; }
  return [l, r];
}
async function readWav(file) { return parseWav(await readFile(file)); }
function wav([l, r]) {
  const n = l.length;
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4);
  }
  return data;
}
/** First and last sample above -45 dBFS. */
function trim([l, r]) {
  const limit = Math.pow(10, -45 / 20);
  let a = 0;
  let b = l.length - 1;
  while (a < l.length && Math.max(Math.abs(l[a]), Math.abs(r[a])) < limit) a++;
  while (b > a && Math.max(Math.abs(l[b]), Math.abs(r[b])) < limit) b--;
  return [l.subarray(Math.max(0, a - RATE * 0.01), b + 1), r.subarray(Math.max(0, a - RATE * 0.01), b + 1)];
}

async function mix(source, duckDb) {
  if (!source || !existsSync(source)) throw new Error('Give a folder of per-line clips or one voiceover file.');
  await mkdir(out, { recursive: true });
  const length = Math.ceil((DURATION / FPS) * RATE);
  const voice = [new Float32Array(length), new Float32Array(length)];
  const report = [];
  const place = (clip, at) => { for (let c = 0; c < 2; c++) for (let i = 0; i < clip[c].length && at + i < length; i++) voice[c][at + i] += clip[c][i]; };
  if (statSync(source).isDirectory()) {
    const files = readdirSync(source).filter((f) => /^\d+/.test(f) && /\.(wav|mp3|m4a|aac|ogg|flac|mp4|mov|webm)$/i.test(f));
    const byNumber = new Map(files.map((f) => [Number(f.match(/^\d+/)[0]), f]));
    for (const l of lines) {
      const file = byNumber.get(l.n);
      if (!file) { report.push(`${String(l.n).padStart(2, '0')}  missing                     ${l.text}`); continue; }
      const clip = trim(decode(join(source, file)));
      const seconds = clip[0].length / RATE;
      const slot = (l.next - l.from) / FPS;
      place(clip, Math.round((l.from / FPS) * RATE));
      report.push(`${String(l.n).padStart(2, '0')}  ${seconds.toFixed(1).padStart(4)} s of ${slot.toFixed(1).padStart(4)} s  ${seconds > slot ? 'TOO LONG by ' + (seconds - slot).toFixed(1) + ' s' : 'ok'.padEnd(16)}  ${basename(file)}`);
    }
  } else {
    place(decode(source), 0);
    report.push('one take placed at 0:00: ' + basename(source));
  }
  // loudness: bring the voice to about -16 dBFS RMS while it speaks, peaks under -1 dBFS
  let sum = 0;
  let count = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) { const v = Math.max(Math.abs(voice[0][i]), Math.abs(voice[1][i])); peak = Math.max(peak, v); if (v > 0.01) { sum += v * v; count++; } }
  if (!count) throw new Error('The voiceover is silent.');
  const gain = Math.min(Math.pow(10, -16 / 20) / Math.sqrt(sum / count), 0.89 / peak);
  for (const ch of voice) for (let i = 0; i < length; i++) ch[i] *= gain;
  // duck the music while the voice speaks (10 ms attack, 400 ms release)
  const music = await readWav(root + 'public/music.wav');
  const sfx = await readWav(root + 'public/sfx.wav');
  const floor = Math.pow(10, -duckDb / 20);
  const attack = 1 - Math.exp(-1 / (0.01 * RATE));
  const release = 1 - Math.exp(-1 / (0.4 * RATE));
  let env = 0;
  const final = [new Float32Array(length), new Float32Array(length)];
  for (let i = 0; i < length; i++) {
    const v = Math.max(Math.abs(voice[0][i]), Math.abs(voice[1][i]));
    env += (v > env ? attack : release) * (v - env);
    const duck = 1 - (1 - floor) * Math.min(1, env / 0.05);
    for (let c = 0; c < 2; c++) {
      const x = (music[c][i] ?? 0) * duck + (sfx[c][i] ?? 0) * 0.8 + voice[c][i];
      final[c][i] = Math.tanh(x * 1.05) / 1.05;
    }
  }
  rmSync(out + '.decode.wav', { force: true });
  await writeFile(out + 'voice-only.wav', wav(voice));
  await writeFile(out + 'mix-with-voice.wav', wav(final));
  for (const name of ['treaty-demo-1920x1080', 'treaty-demo-1080x1920']) {
    const video = root + 'out/' + name + '.mp4';
    if (!existsSync(video)) { report.push('skipped ' + name + ': render it first (npm run render)'); continue; }
    ffmpeg(['-y', '-i', video, '-i', out + 'mix-with-voice.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', root + 'out/' + name + '-voiceover.mp4']);
    report.push('wrote out/' + name + '-voiceover.mp4');
  }
  console.log(report.join('\n'));
}

const [command, source, ...rest] = process.argv.slice(2);
const duckIndex = rest.indexOf('--duck');
if (command === 'script') await script();
else if (command === 'mix') await mix(source, duckIndex >= 0 ? Number(rest[duckIndex + 1]) : 10);
else console.log('Usage: node scripts/voiceover.mjs script | mix <folder-or-file> [--duck 10]');
