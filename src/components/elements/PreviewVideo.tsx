// A silent looping video over a tile's picture, on the grids and the canvas (the web page's <video> in buildCard / board-clip;
// Cosmos draws only the cover in both, these play by the person's choice, HANDOFF 6.169): its preview first, then the
// original if that does not play. Its player waits its turn (lib/previewStarts), gets ready paused and plays once its
// first frame is in; it stays see-through until it is moving (VideoElementTsx1's videoReadyMap waits for the first frame;
// here the strip or the cover under it shows a little longer, so a start that stutters is not seen). The player and its
// listeners are made together, so no event of a quick clip is missed (useEvent only listens after a render).
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { VideoPlayer, VideoView } from 'react-native-video';
import { waitForPreviewTurn } from '../../lib/previewStarts';

const BUFFER = { minBufferMs: 1000, maxBufferMs: 4000, bufferForPlaybackMs: 500, bufferForPlaybackAfterRebufferMs: 500, preferredForwardBufferDurationMs: 2000 };
const RELEASE_DELAY = 300; // the view showing it goes first
const START_WAIT_MS = 2500;
const SHOW_MS = 180; // faded in over what was under it (a cover, or a strip showing another frame): a cut jumped

export function PreviewVideo({ urls, playing }: { urls: string[]; playing: boolean }) {
  const [at, setAt] = useState(0);
  const uri = urls[at];
  if (!uri) return null;
  return <PreviewSurface key={uri} uri={uri} playing={playing} onFail={() => setAt((n) => (n + 1 < urls.length ? n + 1 : n))} />;
}

function PreviewSurface({ uri, playing, onFail }: { uri: string; playing: boolean; onFail: () => void }) {
  const opacity = useSharedValue(0);
  const now = useRef({ playing, onFail, started: false });
  now.current.playing = playing;
  now.current.onFail = onFail;
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  useEffect(() => {
    let p: VideoPlayer | null = null;
    let late: ReturnType<typeof setTimeout> | undefined;
    const subs: { remove: () => void }[] = [];
    const done = waitForPreviewTurn(() => {
      const made = new VideoPlayer({ uri, bufferConfig: BUFFER });
      p = made;
      const apply = () => {
        made.loop = true;
        made.muted = true;
        if (now.current.started && now.current.playing) made.play();
        else made.pause();
      };
      const start = () => {
        if (now.current.started) return;
        now.current.started = true;
        done();
        apply();
        if (!now.current.playing) opacity.value = withTiming(1, { duration: SHOW_MS }); // a still one shows its first frame
      };
      apply();
      subs.push(made.addEventListener('onLoadStart', apply));
      subs.push(made.addEventListener('onStatusChange', apply));
      subs.push(made.addEventListener('onReadyToDisplay', start));
      const moving = made.addEventListener('onProgress', ({ currentTime }) => {
        if (!now.current.started || currentTime <= 0) return;
        opacity.value = withTiming(1, { duration: SHOW_MS });
        moving.remove();
      });
      subs.push(moving);
      subs.push(made.addEventListener('onError', () => { done(); now.current.onFail(); }));
      late = setTimeout(start, START_WAIT_MS); // no word of its first frame: it plays anyway
      setPlayer(made);
    });
    return () => {
      done();
      clearTimeout(late);
      subs.forEach((s) => s.remove());
      const q = p as VideoPlayer | null;
      if (q) {
        q.pause();
        setTimeout(() => q.release(), RELEASE_DELAY);
      }
    };
  }, [uri, opacity]);
  useEffect(() => {
    if (!player || !now.current.started) return;
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!player) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <VideoView player={player} controls={false} pictureInPicture={false} autoEnterPictureInPicture={false} surfaceType="texture" resizeMode="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}
