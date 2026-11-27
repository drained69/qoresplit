// Review frames: node scripts/stills.mjs [h|v|both] frame frame ...
import { mkdir } from 'node:fs/promises';
import { renderStill, selectComposition } from '@remotion/renderer';
import { browserExecutable, chromiumOptions, makeBundle, root } from './shared.mjs';

const [which = 'both', ...frames] = process.argv.slice(2);
const serveUrl = await makeBundle();
await mkdir(root + 'out/review', { recursive: true });
for (const id of which === 'both' ? ['Treaty', 'TreatyVertical'] : [which === 'v' ? 'TreatyVertical' : 'Treaty']) {
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
  for (const frame of frames.map(Number)) {
    const output = `${root}out/review/${id === 'Treaty' ? 'h' : 'v'}-${String(frame).padStart(4, '0')}.png`;
    await renderStill({ serveUrl, composition, frame, output, browserExecutable, chromiumOptions, scale: id === 'Treaty' ? 0.5 : 0.4 });
    console.log(output);
  }
}
