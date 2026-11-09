import { clamp } from '../breath/patterns'
import type { Lang } from '../i18n'

export type MeditationId = 'bodyScan' | 'grounding' | 'countBreaths' | 'timer'
export interface Cue { start: number; text: Record<Lang, string>; bell: boolean }
export interface Meditation { cues: Cue[]; total: number }

/** [seconds the line stays, bell, fr, en] */
type Line = [number, boolean, string, string]

const BODY_SCAN: Line[] = [
  [20, true, 'Installe-toi. Ferme les yeux si tu veux. Laisse le souffle aller à son rythme.', 'Settle in. Close your eyes if you like. Let your breath set its own pace.'],
  [25, true, 'Les pieds. Remarque leur poids, leur température, ce qu’ils touchent.', 'Your feet. Notice their weight, their temperature, what they touch.'],
  [25, true, 'Les mollets et les genoux. Sans rien changer, observe ce qui est là.', 'Your calves and knees. Change nothing, just notice what is there.'],
  [25, true, 'Les cuisses. Laisse-les devenir lourdes.', 'Your thighs. Let them grow heavy.'],
  [25, true, 'Le bassin et le ventre. Sens le ventre monter et descendre.', 'Your hips and belly. Feel the belly rise and fall.'],
  [25, true, 'Le bas du dos. Si une tension apparaît, laisse-la simplement exister.', 'Your lower back. If there is tension, just let it be there.'],
  [25, true, 'La poitrine. Les côtes s’ouvrent à l’inspiration, se referment à l’expiration.', 'Your chest. The ribs open as you breathe in, close as you breathe out.'],
  [25, true, 'Les épaules. Laisse-les descendre, loin des oreilles.', 'Your shoulders. Let them drop, away from your ears.'],
  [25, true, 'Les bras, puis les mains, jusqu’au bout des doigts.', 'Your arms, then your hands, down to the fingertips.'],
  [25, true, 'La nuque et la mâchoire. Desserre les dents.', 'Your neck and jaw. Unclench your teeth.'],
  [25, true, 'Le visage : le front, les yeux, les joues.', 'Your face: forehead, eyes, cheeks.'],
  [30, true, 'Le corps entier, d’un seul coup. Reste encore quelques souffles ici.', 'The whole body at once. Stay here for a few more breaths.'],
]

const GROUNDING: Line[] = [
  [15, true, 'Ouvre les yeux. On revient à ce qui t’entoure, un sens après l’autre.', 'Keep your eyes open. Come back to your surroundings, one sense at a time.'],
  [35, true, '5 choses que tu vois. Nomme-les une par une, en silence.', '5 things you can see. Name them one by one, silently.'],
  [30, true, '4 choses que tu touches. Le vêtement, le siège, ta peau. Sens leur texture.', '4 things you can touch. Clothing, the seat, your skin. Feel their texture.'],
  [30, true, '3 sons que tu entends. Les plus proches, puis les plus lointains.', '3 sounds you can hear. The nearest first, then the farthest.'],
  [25, true, '2 odeurs. S’il n’y en a pas, cherche celle de l’air.', '2 smells. If there are none, notice the smell of the air.'],
  [20, true, '1 goût dans ta bouche, même léger.', '1 taste in your mouth, however faint.'],
  [15, true, 'Tu es ici. Reprends ton souffle normal.', 'You are here. Return to your normal breath.'],
]

const COUNT_BREATHS: Line[] = [
  [20, true, 'Compte tes expirations : un, deux… jusqu’à dix. Puis reviens à un.', 'Count your out-breaths: one, two… up to ten. Then go back to one.'],
  [40, false, 'Si tu perds le fil ou dépasses dix, recommence à un. Ça fait partie de l’exercice.', 'If you lose count or go past ten, start again at one. That is part of the practice.'],
  [60, false, 'Laisse le souffle se faire tout seul. Toi, tu comptes.', 'Let the breath happen on its own. You just count.'],
  [60, false, 'Une pensée est passée ? Reviens au souffle, reprends à un.', 'A thought came by? Come back to the breath, start again at one.'],
  [60, false, 'Toujours de un à dix, sans te presser.', 'Still one to ten, no rush.'],
  [45, false, 'Encore une minute.', 'One more minute.'],
  [15, true, 'Arrête de compter. Respire librement un instant.', 'Stop counting. Breathe freely for a moment.'],
]

function fromLines(lines: Line[]): Meditation {
  const cues: Cue[] = []
  let total = 0
  for (const [seconds, bell, fr, en] of lines) {
    cues.push({ start: total, bell, text: { fr, en } })
    total += seconds
  }
  return { cues, total }
}

/** The closing bell is played by the session when it ends, not as a cue. */
export function buildMeditation(id: MeditationId, timerMinutes: number): Meditation {
  switch (id) {
    case 'bodyScan':
      return fromLines(BODY_SCAN)
    case 'grounding':
      return fromLines(GROUNDING)
    case 'countBreaths':
      return fromLines(COUNT_BREATHS)
    case 'timer':
      return {
        cues: [{ start: 0, bell: true, text: { fr: 'Installe-toi. Rien à faire, juste être là.', en: 'Settle in. Nothing to do, just be here.' } }],
        total: clamp(timerMinutes, 1, 60, 10) * 60,
      }
  }
}

export function cueAt(m: Meditation, seconds: number): Cue | null {
  if (seconds >= m.total || seconds < 0) return null
  let found: Cue | null = null
  for (const c of m.cues) if (c.start <= seconds) found = c
  return found
}
