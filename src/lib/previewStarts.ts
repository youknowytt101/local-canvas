// The silent previews of the grids and the canvas start a few at a time (not in Cosmos, which plays none; HANDOFF 6.170):
// a preview asks for its turn once its file is here (lib/previewFiles), its player is made when the turn comes, and the
// next one starts once its first frame is drawn. A screen of them made at once had every decoder start together (their
// first second dropped frames) and making the players held up the main thread while the canvas was being moved. In the
// order asked for (the grids ask nearest the middle first), except that one wanted on screen goes before those only
// being prepared ahead (lib/gridVideos).
import { Platform } from 'react-native';

const AT_ONCE = Platform.OS === 'ios' ? 2 : 1;
const WAIT_MS = 1500; // one whose first frame does not come makes way anyway (its file is here: it is the decoder)

type Waiting = { go: () => void; urgent: () => boolean; state: 'waiting' | 'starting' | 'done'; timer?: ReturnType<typeof setTimeout> };

const queue: Waiting[] = [];
let starting = 0;

function pump() {
  while (starting < AT_ONCE && queue.length) {
    const first = queue.findIndex((w) => w.urgent());
    const next = queue.splice(first >= 0 ? first : 0, 1)[0];
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

// go is called once it is this one's turn (urgent: it is wanted on screen now, not only prepared); the function returned
// is called once its first frame is drawn, it has failed or it is no longer wanted (waiting or not)
export function waitForPreviewTurn(go: () => void, urgent: () => boolean = () => true): () => void {
  const w: Waiting = { go, urgent, state: 'waiting' };
  queue.push(w);
  queueMicrotask(pump); // the ones mounted in the same render line up first, in their order
  return () => finish(w);
}
