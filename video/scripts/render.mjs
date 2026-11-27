// Final renders: node scripts/render.mjs [h|v|both]
//   out/treaty-demo-1920x1080.mp4            music + interface sounds, subtitles burned in
//   out/treaty-demo-1920x1080-no-music.mp4   interface sounds only, for recording the voiceover over
//   out/treaty-demo-1080x1920.mp4 (+ -no-music)  the vertical cut for Instagram and X
//   out/cover.png, out/cover-vertical.png    frame 0, the finished cover
//   out/treaty-music.wav, out/treaty-sfx.wav the two stems
//   out/treaty-demo.srt                      the voiceover subtitles
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { browserExecutable, chromiumOptions, makeBundle, root } from './shared.mjs';

const which = process.argv[2] ?? 'both';
const out = root + 'out/';
await mkdir(out, { recursive: true });
execFileSync(process.execPath, [root + 'scripts/audio.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, [root + 'scripts/srt.mjs'], { stdio: 'inherit' });
await copyFile(root + 'public/music.wav', out + 'treaty-music.wav');
await copyFile(root + 'public/sfx.wav', out + 'treaty-sfx.wav');

const serveUrl = await makeBundle();
const ffmpeg = (args) => execFileSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: root, stdio: 'inherit' });

for (const [id, name, still] of [['Treaty', 'treaty-demo-1920x1080', 'cover.png'], ['TreatyVertical', 'treaty-demo-1080x1920', 'cover-vertical.png']]) {
  if (which === 'h' && id !== 'Treaty') continue;
  if (which === 'v' && id !== 'TreatyVertical') continue;
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
  await renderStill({ serveUrl, composition, frame: 0, output: out + still, browserExecutable, chromiumOptions });
  const silent = out + name + '.video.mp4';
  let last = -1;
  await renderMedia({
    serveUrl, composition, codec: 'h264', crf: 16, pixelFormat: 'yuv420p', x264Preset: 'slow', muted: true,
    outputLocation: silent, browserExecutable, chromiumOptions, concurrency: 4,
    onProgress: ({ progress }) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; console.log(id, Math.round(progress * 100) + '%'); } },
  });
  const mux = (audio, file) => ffmpeg(['-i', silent, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', file]);
  mux(root + 'public/mix.wav', out + name + '.mp4');
  mux(root + 'public/sfx.wav', out + name + '-no-music.mp4');
  await rm(silent);
  console.log('wrote', name + '.mp4', name + '-no-music.mp4', still);
}
