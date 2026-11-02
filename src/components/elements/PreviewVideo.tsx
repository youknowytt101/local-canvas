// A silent looping video over a tile's picture, on the grids and the canvas (the web page's <video> in buildCard / board-clip;
// Cosmos draws only the cover in both, these play by the person's choice, HANDOFF 6.169): its preview first, then the
// original if that does not play. See-through until its first frame (VideoElementTsx1's videoReadyMap). The player and
// its listeners are made together, so no event of a quick clip is missed (useEvent only listens after a render).
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { VideoPlayer, VideoView } from 'react-native-video';

const BUFFER = { minBufferMs: 1000, maxBufferMs: 4000, bufferForPlaybackMs: 250, bufferForPlaybackAfterRebufferMs: 500, preferredForwardBufferDurationMs: 2000 };
const RELEASE_DELAY = 300; // the view showing it goes first

export function PreviewVideo({ urls, playing }: { urls: string[]; playing: boolean }) {
  const [at, setAt] = useState(0);
  const uri = urls[at];
  if (!uri) return null;
  return <PreviewSurface key={uri} uri={uri} playing={playing} onFail={() => setAt((n) => (n + 1 < urls.length ? n + 1 : n))} />;
}

function PreviewSurface({ uri, playing, onFail }: { uri: string; playing: boolean; onFail: () => void }) {
  const opacity = useSharedValue(0);
  const now = useRef({ playing, onFail });
  now.current = { playing, onFail };
  const [player] = useState(() => {
    const p = new VideoPlayer({ uri, bufferConfig: BUFFER });
    const apply = () => {
      p.loop = true;
      p.muted = true;
      if (now.current.playing) p.play();
      else p.pause();
    };
    apply();
    p.addEventListener('onLoadStart', apply);
    p.addEventListener('onStatusChange', apply);
    p.addEventListener('onReadyToDisplay', () => { opacity.value = 1; });
    p.addEventListener('onError', () => now.current.onFail());
    return p;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);
  useEffect(() => () => {
    player.pause();
    setTimeout(() => player.release(), RELEASE_DELAY);
  }, [player]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <VideoView player={player} controls={false} pictureInPicture={false} autoEnterPictureInPicture={false} surfaceType="texture" resizeMode="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}
