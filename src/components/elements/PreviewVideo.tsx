// A silent looping video over a tile's picture, on the grids and the canvas' tapped video (the web page's <video> in
// buildCard / board-clip; Cosmos draws only the cover in both, these play by the person's choice, HANDOFF 6.169 /
// 6.181), with expo-video:
//   - its preview plays from its file (lib/previewFiles: fetched once, looped without the network); a video without
//     one, or whose preview cannot be fetched or played, streams its original through expo-video's disk cache, so
//     that its loops do not fetch it again either
//   - its player is made once the file is here and its turn has come (lib/previewStarts), and the next one may start
//     once its first frame is drawn; on Android it is given its video only once its view has its Surface, so that its
//     decoder is never moved onto it (lib/videoSurface)
//   - one not playing is prepared all the same and stays on its first frame (a grid's tile about to come on screen,
//     lib/gridVideos): playing it then is only play()
//   - nothing hides it: VideoView stays see-through until its first frame (a clear view on iOS, the surface at alpha 0
//     on Android), so the cover under it shows till then
//   - silent, it keeps no screen awake and leaves other apps' sound alone (audioMixingMode 'auto' mixes while nothing
//     is heard)
import { createVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { Element } from '../../lib/elements';
import { dropPreviewFile, fetchPreview, previewFile } from '../../lib/previewFiles';
import { waitForPreviewTurn } from '../../lib/previewStarts';
import { absoluteUrl } from '../../lib/server';
import { afterSurface, SOURCE_AFTER_SURFACE } from '../../lib/videoSurface';

// an original streamed: a couple of seconds ahead, starting as soon as there is something to show
const STREAM_BUFFER = { preferredForwardBufferDuration: 2, waitsToMinimizeStalling: false, minBufferForPlayback: 0.5 };
const RELEASE_DELAY = 300; // the view showing it goes first

export const previewUrlOf = (el: Element) => (el.mediaKind === 'video' && !el.embed && el.previewUrl ? absoluteUrl(el.previewUrl) : null);

export function PreviewVideo({ element, playing }: { element: Element; playing: boolean }) {
  const preview = previewUrlOf(element);
  const original = element.mediaKind === 'video' && !element.embed && element.mediaUrl ? absoluteUrl(element.mediaUrl) : null;
  const [uri, setUri] = useState<string | null>(() => (preview ? previewFile(preview) : original));
  const [fetching, setFetching] = useState(!!preview && !uri);
  useEffect(() => {
    if (!fetching || !preview) return undefined;
    let live = true;
    fetchPreview(preview).then(
      (file) => { if (live) { setUri(file); setFetching(false); } },
      () => { if (live) { setUri(original); setFetching(false); } },
    );
    return () => { live = false; };
  }, [fetching, preview, original]);
  const onFail = () => {
    if (preview && uri && uri !== original && uri !== preview) dropPreviewFile(preview); // its file would not play
    setUri((was) => (was !== original ? original : null));
  };
  if (!uri) return null;
  return <PreviewSurface key={uri} uri={uri} playing={playing} onFail={onFail} />;
}

function PreviewSurface({ uri, playing, onFail }: { uri: string; playing: boolean; onFail: () => void }) {
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const now = useRef({ playing, onFail, done: () => {}, giveSource: () => {} });
  now.current.playing = playing;
  now.current.onFail = onFail;
  useEffect(() => {
    let made: VideoPlayer | null = null;
    let sub: { remove: () => void } | undefined;
    let live = true;
    // an original streams once into expo-video's own cache and loops from there (its files are too big to fetch whole)
    const source = uri.startsWith('file:') ? { uri } : { uri, useCaching: true };
    const done = waitForPreviewTurn(() => {
      // on Android its video comes once its view has its Surface (lib/videoSurface)
      const p = createVideoPlayer(SOURCE_AFTER_SURFACE ? null : source);
      if (SOURCE_AFTER_SURFACE) {
        let given = false;
        now.current.giveSource = () => {
          if (given) return;
          given = true;
          afterSurface(() => { if (live) void p.replaceAsync(source); });
        };
      }
      p.loop = true;
      p.muted = true;
      p.keepScreenOnWhilePlaying = false;
      if (!uri.startsWith('file:')) p.bufferOptions = STREAM_BUFFER;
      sub = p.addListener('statusChange', ({ status }) => {
        if (status !== 'error') return;
        done();
        now.current.onFail();
      });
      if (now.current.playing) p.play();
      made = p;
      setPlayer(p);
    }, () => now.current.playing);
    now.current.done = done;
    return () => {
      live = false;
      done();
      sub?.remove();
      const q = made as VideoPlayer | null;
      if (q) {
        q.pause();
        setTimeout(() => q.release(), RELEASE_DELAY);
      }
    };
  }, [uri]);
  useEffect(() => {
    if (!player) return;
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);
  if (!player) return null;
  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="cover"
      allowsPictureInPicture={false}
      allowsVideoFrameAnalysis={false}
      surfaceType="textureView" // Android: clipped to the tile's corners, moved and faded with the canvas' cards
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={SOURCE_AFTER_SURFACE ? () => now.current.giveSource() : undefined}
      onFirstFrameRender={() => now.current.done()}
    />
  );
}
