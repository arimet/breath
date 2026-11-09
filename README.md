# Breath

A small web app for guided breathing, short meditations and falling asleep, painted as a watercolor landscape. It installs on a phone home screen and works offline. Free, no account, nothing about your sessions is stored.

Interface in French and English.

## What's inside

**Breathing**

| Exercise | Rhythm | Default |
|---|---|---|
| Box breathing | 3 s in · 3 s hold · 3 s out · 3 s rest | 5 min |
| Coherent breathing | 5 s in · 5 s out (6 breaths/min) | 5 min |
| 4-7-8 breathing | 4 s in · 7 s hold · 8 s out | 4 cycles |
| Cyclic sighing | 2 s in · 1 s second sip · 6 s out | 5 min |
| My rhythm | each phase 0–10 s | 1–20 min |

**Meditation**: body scan (5 min), 5-4-3-2-1 grounding (3 min), counting breaths (5 min), open timer (1–60 min).

**Sleep**: breathing slows from 12 to 6 breaths a minute over 5 minutes, then four 4-7-8 cycles, then 6 minutes of free breathing while the sound fades out and the screen goes black.

A short safety notice is shown on first launch, and every session has an "I feel dizzy" button that stops it.

## Sources

- Box breathing: [Cleveland Clinic](https://health.clevelandclinic.org/box-breathing-benefits)
- Cyclic sighing and box breathing compared with mindfulness: Balban et al., *Cell Reports Medicine*, 2023 ([PMC9873947](https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947))
- 4-7-8 breathing (Andrew Weil): [Cleveland Clinic](https://health.clevelandclinic.org/4-7-8-breathing)
- Resonance breathing around 6 breaths/min: [meta-analysis, *Mindfulness*, 2024](https://link.springer.com/content/pdf/10.1007/s12671-023-02294-2.pdf)
- Breath counting: Levinson et al., *Frontiers in Psychology*, 2014 ([link](https://www.frontiersin.org/articles/10.3389/fpsyg.2014.01202/full))
- 5-4-3-2-1 grounding: [URMC](https://www.urmc.rochester.edu/behavioral-health-partners/bhp-blog/april-2018/5-4-3-2-1-coping-technique-for-anxiety)

Evidence that any of these helps you fall asleep is thin. This app is not medical advice.

## iPhone notes

- Add it to the home screen from Safari (Share → Add to Home Screen).
- iOS stops web audio when the phone locks, so Breath keeps the screen on during a session (Screen Wake Lock, reliable for home-screen apps from iOS 18.4).
- Sound plays even with the silent switch on (Audio Session API), and only starts after you tap Start.
- iPhones don't let web apps vibrate, so cues are visual and audible only.

## Sounds

Ambient loops by Joseph Sardin – [BigSoundBank.com](https://bigsoundbank.com/), CC0. Details in [`public/sounds/CREDITS.md`](public/sounds/CREDITS.md). Phase notes and the bell are synthesized with the Web Audio API.

## Development

```bash
npm install
npm run dev       # http://localhost:5173 — add ?speed=20 to fast-forward sessions
npm test
npm run build     # dist/, with the service worker generated from sw/sw.js
```

Vanilla TypeScript and Vite, no runtime dependency. The landscape is a single SVG with watercolor filters (`src/ui/landscape.ts`).

## License

MIT
