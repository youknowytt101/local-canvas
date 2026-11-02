// How many silent previews may decode at once on the grids, and whether the viewer prepares its neighbours, following
// how warm the phone is (modules/power-state). Not in Cosmos, which plays no
// previews; the previews are the person's choice (HANDOFF 6.169). A decoder at work is most of what playing a video
// costs (the decoding and the display, media3's battery guide), and the phone's own thermal state is the one signal of
// what that adds up to, so the work eases off as it rises, as Apple asks of apps and as short video apps do (Douyin's
// PlayerPowerThermalConfig, Meta's device stress detection, HANDOFF 6.166):
//   - cool (nominal): the previews nearest the middle play, PREVIEWS of them
//   - fair, or Low Power Mode: half as many
//   - serious or critical: none, the covers stay; the viewer plays its own video but prepares no neighbours
// The viewer's own video always plays: it is what the person opened; so does the video tapped on the canvas (HANDOFF
// 6.181), which is the only one the canvas plays.
import { Platform } from 'react-native';
import { currentPowerState, watchPowerState, type PowerState } from '../../modules/power-state';

// a phone screen of the grid shows 3 or 4 videos whole; a preview is 480 px wide. An
// Android phone has a few hardware decoders to share with the viewer (the emulator 4 for H.264)
const PREVIEWS = Platform.OS === 'ios' ? 6 : 4;

export type VideoBudget = { previews: number; originals: number; neighbours: boolean };

let state: PowerState = currentPowerState();
const listeners = new Set<() => void>();
let unwatch: (() => void) | null = null;

function budgetFor({ thermal, lowPower }: PowerState): VideoBudget {
  if (thermal >= 2) return { previews: 0, originals: 0, neighbours: false };
  if (thermal >= 1 || lowPower) return { previews: Math.ceil(PREVIEWS / 2), originals: 1, neighbours: true };
  return { previews: PREVIEWS, originals: 1, neighbours: true };
}

let budget = budgetFor(state);
export const videoBudget = () => budget;

// told when the budget changes; the function returned stops it
export function watchVideoBudget(listener: () => void): () => void {
  listeners.add(listener);
  if (!unwatch) {
    state = currentPowerState(); // what changed while no one was listening
    budget = budgetFor(state);
  }
  unwatch ??= watchPowerState((next) => {
    state = next;
    const was = budget;
    budget = budgetFor(next);
    if (was.previews !== budget.previews || was.originals !== budget.originals || was.neighbours !== budget.neighbours) {
      listeners.forEach((l) => l());
    }
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size && unwatch) {
      unwatch();
      unwatch = null;
    }
  };
}
