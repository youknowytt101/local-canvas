// The silent previews of the grids and the canvas start a few at a time (not in Cosmos, which plays none; HANDOFF 6.170):
// a preview waits its turn before its player is made, gets ready paused (its buffer fills and its first frame is
// decoded), and only then plays and makes way for the next. A screen of them made at once had every decoder and the
// network start together: their first second dropped frames, and making the players held up the main thread while the
// canvas was being moved. In the order asked for (the grids and the canvas ask nearest the middle first).
import { Platform } from 'react-native';

const AT_ONCE = Platform.OS === 'ios' ? 2 : 1;
const WAIT_MS = 2500; // one that does not get going makes way anyway

type Waiting = { go: () => void; state: 'waiting' | 'starting' | 'done'; timer?: ReturnType<typeof setTimeout> };

const queue: Waiting[] = [];
let starting = 0;

function pump() {
  while (starting < AT_ONCE && queue.length) {
    const next = queue.shift()!;
    next.state = 'starting';
    starting += 1;
    next.timer = setTimeout(() => finish(next), WAIT_MS);
    next.go();
  }
}

function finish(w: Waiting) {
  if (w.state === 'waiting') {
    const at = queue.indexOf(w);
    if (at >= 0) queue.splice(at, 1);
  } else if (w.state === 'starting') {
    clearTimeout(w.timer);
    starting -= 1;
  }
  w.state = 'done';
  pump();
}

// go is called once it is this one's turn; the function returned is called once it plays, has failed or is no longer
// wanted (waiting or not)
export function waitForPreviewTurn(go: () => void): () => void {
  const w: Waiting = { go, state: 'waiting' };
  queue.push(w);
  queueMicrotask(pump); // the ones mounted in the same render line up first, in their order
  return () => finish(w);
}
