import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './treaty.css';
import { Caption, Subtitles } from './components';
import { C, ramp } from './lib';
import { Attack } from './scenes/Attack';
import { Close, Requirements } from './scenes/Close';
import { Desk, geometry } from './scenes/Desk';
import { Hook } from './scenes/Hook';
import { Proof } from './scenes/Proof';
import { CUE, s } from './timeline.mjs';

export type Props = { vertical: boolean; subtitles: boolean; audio: 'none' | 'mix' | 'sfx' };

/** Fonts from npm (@fontsource-variable): wait until every weight used is ready. */
function useFonts() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const faces = ['400', '500', '600', '650', '700'].flatMap((w) => [`${w} 20px "Geist Variable"`, `${w} 20px "Geist Mono Variable"`]);
    Promise.all(faces.map((face) => document.fonts.load(face))).then(() => document.fonts.ready).then(() => continueRender(handle));
  }, [handle]);
}

export const Main: React.FC<Props> = ({ vertical, subtitles, audio }) => {
  useFonts();
  const f = useCurrentFrame();
  const g = geometry(vertical);
  const dark = Math.min(ramp(f, CUE.attackIn - 4, CUE.attackIn + 10), 1 - ramp(f, s(125) - 6, s(125) + 12));
  const desk = (f >= s(20) - 2 && f < s(105) + 2) || (f >= s(125) - 2 && f < s(145) + 2);
  const deskO = Math.min(ramp(f, s(20) - 2, s(20) + 14), 1 - ramp(f, s(145) - 12, s(145) + 2)) * (1 - dark);
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `linear-gradient(#2f7a3e0b 1px, transparent 1px) 0 0 / 48px 48px, linear-gradient(90deg, #2f7a3e0b 1px, transparent 1px) 0 0 / 48px 48px` }} />
      <AbsoluteFill style={{ background: `radial-gradient(1200px 800px at 70% 40%, #9b2f2530, transparent 70%), ${C.forest}`, opacity: dark }} />
      {f < s(20) + 10 && <Hook f={f} vertical={vertical} />}
      {desk && <AbsoluteFill style={{ opacity: deskO }}><Desk f={f} g={g} /></AbsoluteFill>}
      {f >= s(105) - 2 && f < s(125) + 2 && <Attack f={f} g={g} />}
      {f >= s(145) - 2 && f < s(165) + 2 && <Proof f={f} g={g} />}
      {f >= CUE.reqsIn - 2 && <Requirements f={f} vertical={vertical} />}
      <Close f={f} vertical={vertical} />
      <Caption f={f} vertical={vertical} />
      {subtitles && <Subtitles f={f} vertical={vertical} />}
      {audio === 'mix' && <Audio src={staticFile('mix.wav')} />}
      {audio === 'sfx' && <Audio src={staticFile('sfx.wav')} />}
    </AbsoluteFill>
  );
};
