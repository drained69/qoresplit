// Shared render settings: the pre-installed Chrome headless shell, and one bundle per run.
import { bundle } from '@remotion/bundler';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
const candidates = [
  process.env.REMOTION_CHROME,
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
].filter(Boolean);
export const browserExecutable = candidates.find((path) => existsSync(path)) ?? null;
export const chromiumOptions = { gl: 'swangle' };

export async function makeBundle() {
  return bundle({ entryPoint: root + 'src/index.ts', publicDir: root + 'public' });
}
