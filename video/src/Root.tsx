import React from 'react';
import { Composition, Still } from 'remotion';
import { Main, type Props } from './Main';
import { DURATION, FPS } from './timeline.mjs';

export const Root: React.FC = () => (
  <>
    <Composition id="Treaty" component={Main} durationInFrames={DURATION} fps={FPS} width={1920} height={1080}
      defaultProps={{ vertical: false, subtitles: true, audio: 'none' } satisfies Props} />
    <Composition id="TreatyVertical" component={Main} durationInFrames={DURATION} fps={FPS} width={1080} height={1920}
      defaultProps={{ vertical: true, subtitles: true, audio: 'none' } satisfies Props} />
    <Still id="Cover" component={Main} width={1920} height={1080} defaultProps={{ vertical: false, subtitles: false, audio: 'none' } satisfies Props} />
    <Still id="CoverVertical" component={Main} width={1080} height={1920} defaultProps={{ vertical: true, subtitles: false, audio: 'none' } satisfies Props} />
  </>
);
