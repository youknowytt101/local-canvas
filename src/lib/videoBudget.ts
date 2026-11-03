// How many silent previews the grids may play and keep prepared at once, and whether the viewer prepares its neighbours,
// following how warm the phone is (modules/power-state). Not in Cosmos, which plays no
// previews; the previews are the person's choice (HANDOFF 6.169). A decoder at work is most of what playing a video
// costs (the decoding and the display, media3's battery guide), and the phone's own thermal state is the one signal of
// what that adds up to, so the work eases off as it rises, as Apple asks of apps and as short video apps do (Douyin's
// PlayerPowerThermalConfig, Meta's device stress detection, HANDOFF 6.166):
//   - cool (nominal): every preview at least half on screen plays, up to PREVIEWS, and AHEAD more are prepared
//   - fair, or Low Power Mode: half as many play, one is prepared
//   - serious or critical: none, the covers stay; the viewer plays its own video but prepares no neighbours
// The viewer's own video always plays: it is what the person opened; so does the video tapped on the canvas (HANDOFF
// 6.181), which is the only one the canvas plays.
import { Platform } from 'react-native';
import { currentPowerState, watchPowerState, type PowerState } from '../../modules/power-state';

// A screen of the two-column grid shows 4 to 8 tiles whole. A preview is 480 px wide (about 12 Mpx a second at 30 fps),
// so even 8 at once are a fraction of what a phone's hardware decoder does (a 1080p30 stream is 62 Mpx a second); what
// bounds them is how many decoders may exist at once, a paused player's counting too: iOS gives no number (players past
// about 14 - 16 were reported to fail with "Cannot Decode", HANDOFF 6.183), an Android phone's media_codecs.xml says,
// and the emulator's goldfish H.264 decoder allows 4 (HANDOFF 6.159). So about half of them, the rest for the viewer
const constants = Platform.constants as { Model?: string; Fingerprint?: string };
const EMULATOR = Platform.OS === 'android' && /sdk_gphone|emulator|generic/i.test(`${constants.Model ?? ''} ${constants.Fingerprint ?? ''}`);
const PREVIEWS = Platform.OS === 'ios' ? 8 : EMULATOR ? 3 : 6;
const AHEAD = EMULATOR ? 1 : 2;

// previews: how many play; ahead: how many more are prepared, paused on their first frame; originals: how many of the
// videos without a preview stream their original
export type VideoBudget = { previews: number; ahead: number; originals: number; neighbours: boolean };

let state: PowerState = currentPowerState();
const listeners = new Set<() => void>();
let unwatch: (() => void) | null = null;

function budgetFor({ thermal, lowPower }: PowerState): VideoBudget {
  if (thermal >= 2) return { previews: 0, ahead: 0, originals: 0, neighbours: false };
  if (thermal >= 1 || lowPower) return { previews: Math.ceil(PREVIEWS / 2), ahead: 1, originals: 1, neighbours: true };
  return { previews: PREVIEWS, ahead: AHEAD, originals: 1, neighbours: true };
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
    if (was.previews !== budget.previews || was.ahead !== budget.ahead || was.originals !== budget.originals || was.neighbours !== budget.neighbours) {
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
