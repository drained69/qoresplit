// Subtitles of the voiceover (SUBMISSION.md §5), from the same timeline the video burns in.
import { mkdir, writeFile } from 'node:fs/promises';
import { FPS, SUBTITLES } from '../src/timeline.mjs';

const stamp = (frame) => {
  const ms = Math.round((frame / FPS) * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};
const srt = SUBTITLES.map(([from, to, text], i) => `${i + 1}\n${stamp(from)} --> ${stamp(to)}\n${text}\n`).join('\n');
await mkdir(new URL('../out/', import.meta.url), { recursive: true });
await writeFile(new URL('../out/treaty-demo.srt', import.meta.url), srt);
console.log('out/treaty-demo.srt:', SUBTITLES.length, 'cues');
