# Treaty demo video

The 2:59 product demo for Build Before Q-Day (Post-Quantum AI Agents), made with Remotion. Every frame,
subtitle and sound is code, and all three are timed from one file, [`src/timeline.mjs`](src/timeline.mjs),
so picture and sound can't drift apart.

```sh
cd video
npm ci
npm run render          # both formats, both audio versions, the cover, the stems and the .srt (into out/)
npm run studio          # preview and scrub in Remotion Studio (run `npm run audio` first for sound)
node scripts/stills.mjs h 0 1800 3400   # review frames into out/review/ (h, v or both)
```

Rendering uses the Chrome headless shell that is already installed (`/opt/pw-browsers/...`; set
`REMOTION_CHROME` to use another) and Remotion's own ffmpeg. `out/` and the generated `.wav` files are
git-ignored.

## Voiceover (Higgsfield or any text-to-speech)

```sh
node scripts/voiceover.mjs script        # out/voiceover/VOICEOVER.md: every line, its cue, its slot, TTS-ready text
node scripts/voiceover.mjs mix voice     # voice/01.wav, 02.wav, … → placed on their cues, music ducked 10 dB
```

The mix writes `out/treaty-demo-1920x1080-voiceover.mp4` and `out/treaty-demo-1080x1920-voiceover.mp4`
(picture copied, not re-encoded) and reports any clip too long for its slot. See [AUDIT.md](AUDIT.md) for the
step-by-step check of the video.

## Outputs (`out/`)

| File | What |
| --- | --- |
| `treaty-demo-1920x1080.mp4` | Submission and YouTube cut: 1920×1080, 30 fps, H.264 CRF 16, music + interface sounds, subtitles burned in |
| `treaty-demo-1920x1080-no-music.mp4` | The same with interface sounds only, to record the voiceover over |
| `treaty-demo-1080x1920.mp4`, `…-no-music.mp4` | The vertical cut for Instagram and X |
| `cover.png`, `cover-vertical.png` | Frame 0, the finished cover (thumbnail) |
| `treaty-demo.srt` | The voiceover lines from SUBMISSION.md §5, timed per section |
| `treaty-music.wav`, `treaty-sfx.wav` | The two stems, for remixing under a recorded voice |

## Plan

30 fps, 120 BPM (one beat = 15 frames, one bar = 60 frames). The script's sections start on beats; the
music starts a new phrase at each one.

| # | Time | Frames | Length | On screen |
| --- | --- | --- | --- | --- |
| 0 | 0:00–0:20 | 0–600 | 600 | **Cover** (frame 0 is the finished thumbnail: logo, tagline, chips, Treaty #1 doc card with three ML-DSA-87 seals and the "3 paid · 4 QOR refunded" stamp) → **the problem** (two agents paying, the README's three ways it goes today, "One bug, one prompt injection or one stolen key and the money is gone.") → **the quantum threat** (a secp256k1 key guarding 10 QOR cracks on Q-Day) → **"Treaty fixes both."** |
| 01 | 0:20–0:45 | 600–1350 | 750 | Terminal types `npm run demo -- --diana` and the run's opening lines. The research agent's Statement page in the browser; the agent's and Olivia's ML-DSA-87 seals stamp in; the "Owner's limits" card slides in (10 QOR per treaty, 0 of 15 QOR committed); toast "The agent's limits are set." Push-in on the limits. |
| 02–04 | 0:45–1:05 | 1350–1950 | 600 | Treaty #1's page: "Waiting for signatures · 0 of 3" → 1, 2, 3 of 3 as each seal lands (pqcVerify ✓), the terminal printing each signing transaction; "Live · waiting for the budget"; the agent locks 10 QOR → "Live · budget locked", budget counting up. |
| 04 | 1:05–1:20 | 1950–2400 | 450 | The owner's-limit meter: treaty #1's 10 QOR plus treaty #2 ("Label 5,000 images", 10 QOR) runs past the 15 QOR line → hard red stamp "Refused on chain by the owner's limit · MandateLimitExceeded" with a thud. |
| 05 | 1:20–1:45 | 2400–3150 | 750 | The Deliveries ledger: delivery 0 arrives with its work hash highlighted, is accepted, paid 1.6 + 0.4 QOR (coins), Native receipt #42; delivery 1 rejected, nothing paid; delivery 2 waits, the 60 s review period runs out, the cursor clicks "Release payment", paid, receipt #43. |
| 06 | 1:45–2:05 | 3150–3750 | 600 | The attack, in red on dark: the data agent's secp256k1 key is stolen; a forged withdrawal of 3.2 QOR and a junk delivery fly at the contract's pqcVerify gate; **BLOCKED · BadPqcSignature** twice, with a red flash, a shake and the music cut dead. "The data agent's 3.2 QOR stays put." |
| 07–09 | 2:05–2:25 | 3750–4350 | 600 | Olivia clicks "Switch off with QoreX (owner)", signs "Treaty: owner switches off agent …" → "Agent switched off by its owner"; the next acceptance is refused (AgentNotAuthorized). After the deadline 4 QOR goes back to Olivia. The data agent withdraws 4.8 QOR and the cleaning agent 1.2 QOR. |
| ✓ | 2:25–2:45 | 4350–4950 | 600 | The live-deal page: 18/18 transactions, the step-by-step timeline with blocks and hashes, and the four Native receipts #41–#44 with their explorer (explore.qore.network) links. Then QoreX signing "Treaty: accept delivery 0 of treaty #1" in the browser, toast "Delivery 0 accepted and paid.", "Native receipt #42 verified". |
| ✓ | 2:45–2:59 | 4950–5370 | 420 | The track requirements (story.js "Built for the track"), each ticked, "All post-quantum · ML-DSA-87"; then the close: logo, "Binding agent deals", the tagline, "Try it live: treaty-rust.vercel.app · Code: github.com/drained69/qoresplit", "#BuildBeforeQDay". |

## Sound

`scripts/audio.mjs` synthesises everything:

- **Score:** 120 BPM in D major (D–Bm–G–A). A sub bass and a pad below 300 Hz, soft kicks, high hats and
  glassy bells at 2–5 kHz, so the voice band stays clear: 99% of the music's energy is below 300 Hz and
  it sits around −29 dBFS RMS. Darker for the problem, minor tension and a rising swell into the attack,
  a hard stop on the first block, a lift on the release at 2:05, and one resolving chord at the close.
- **Interface sounds,** placed from the timeline's cues: typing, clicks, a stamp for every ML-DSA-87
  signature, a coin for every payment, a toast chime, a low thud for every refusal, whooshes on the big
  moves.

## What on screen is real, and what is illustrative

Real, from the live run on Diana (`deployments/diana-demo.json`, `deployments/diana.json`) and the app's
own screenshots: the contract address, all addresses, every transaction hash and block, the Cosmos
explorer hashes, receipts #41–#44, the terms receipt commitment, the deadline (Nov 26, 2026, 8:04 PM),
the work hashes (recomputed with `deliverableHash` from the demo's datasets and matching the site), all
amounts (10 locked, 1.6/0.4 per unit, 3.2 at the attack, 4 refunded, 4.8 and 1.2 withdrawn), the treaty
and error names, and every line of terminal output (the real `examples/agents-demo.mjs` lines with the
run's values). Page copy, toasts and labels are the app's own text from `src/app.js` and `src/story.js`.

Illustrative or approximate:

- **Mandate expiry "Dec 3, 2026, 7:55 PM"**: start of the run + 7 days, to the minute.
- **"Review until 7:57 PM / 7:58 PM"**: estimated from the block heights; the review timer animation compresses the real 60 s.
- **Clicks and QoreX signing in the browser** are re-enactments. In the live run the agents and Olivia acted through the SDK; the browser shows the same actions as a person would take them in the app (Release payment, Switch off with QoreX, Accept with QoreX).
- **The QoreX signing sheet** is a stylised dialog, not QoreX's real interface; its "treaty-rust.vercel.app wants you to sign:" line is invented. The message text inside is the contract's real format (the switch-off's "change #" line is left out because the nonce isn't recorded).
- **Connected-wallet labels** in the header ("0x8324…BEC2", "0x378C…b998"), the terminal prompt `~/treaty $` and the terminal's title bar.
- **The limit meter, attack diagram, seals, coin chips and big "4 QOR" card** are motion graphics drawn over the app, not app screens.
- **Pacing:** the real run took about 10 minutes on Diana; the video compresses it.

Nothing from `.env`, `.env.diana` or any key is used. The only name shown is the fictional Olivia.
