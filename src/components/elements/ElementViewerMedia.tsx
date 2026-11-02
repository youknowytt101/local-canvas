// The element's media in the viewer (Cosmos' ElementMedia in ElementViewerContainer), sized as Cosmos sizes it
// (module 2440): getContainFittedSize into the screen's width × the media's maximum height, then
// getSnappedContainFittedSize — a size between the screen's width less spacing.md on each side and the whole width
// snaps to whichever of the two is nearer.
//   - a picture: the copy that fits its displayed width (viewerImageSources), the next one if it does not load, over
//     its grid copy while it loads
//   - a video: lib/viewerVideoPlayers has its player, playing on the page on screen and paused on the ones next to it,
//     looping, from silent; over its cover, see-through until its first frame is ready (VideoElementTsx1's
//     videoReadyMap), with no controls of the player's own, only VideoScrubber on the page on screen; elsewhere only its
//     cover
//   - a note: NoteElement (its Markdown, the whole width, spacing.md in)
//   - content filtering: 'blur' blurs it under the veil with 查看, as in the grid
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { VideoView } from 'react-native-video';
import { NSFW_VEIL, tileImageUrl, tileRatio, viewerImageSources, type Element } from '../../lib/elements';
import { playViewerVideo, useIsActiveViewerVideo, useViewerVideo, viewerRevealed, type ViewerVideoEntry } from '../../lib/viewerVideoPlayers';
import { NoteElement } from './NoteElement';
import { VideoScrubber } from './VideoScrubber';

export function getContainFittedSize(maxWidth: number, maxHeight: number, aspect: number) {
  return maxHeight * aspect <= maxWidth ? { width: maxHeight * aspect, height: maxHeight } : { width: maxWidth, height: maxWidth / aspect };
}
export function getSnappedContainFittedSize(maxWidth: number, maxHeight: number, aspect: number, inset: number) {
  const fitted = getContainFittedSize(maxWidth, maxHeight, aspect);
  if (fitted.width >= maxWidth) return fitted;
  const inner = Math.max(maxWidth - inset * 2, 0);
  if (fitted.width <= inner) return fitted;
  return maxWidth - fitted.width <= fitted.width - inner ? { width: maxWidth, height: maxHeight } : { width: inner, height: inner / aspect };
}

type Props = { element: Element; maxWidth: number; maxHeight: number; inset: number };

export function ElementViewerMedia({ element, maxWidth, maxHeight, inset }: Props) {
  const [shown, setShown] = useState(viewerRevealed.has(element.id));
  const blurred = element.nsfw?.treatment === 'blur' && !shown;

  if (element.type === 'note') {
    return <NoteElement text={element.text ?? ''} />;
  }
  const aspect = element.mediaKind === 'video' && !element.width ? 9 / 16 : tileRatio(element.width, element.height);
  if (!element.mediaUrl && !element.posterUrl) {
    return <View style={styles.link}><Text style={styles.linkText}>{element.title || '没有标题'}</Text></View>;
  }
  const size = getSnappedContainFittedSize(maxWidth, maxHeight, aspect, inset);
  return (
    <View style={[styles.box, size, { backgroundColor: element.color ?? undefined }]}>
      <ViewerImage element={element} width={size.width} blurred={blurred} />
      {element.mediaKind === 'video' && !blurred ? <ViewerVideo element={element} /> : null}
      {blurred ? (
        <View style={styles.veil}>
          <Text style={styles.veilText}>{NSFW_VEIL[element.nsfw!.status]}</Text>
          <Pressable style={styles.veilButton} onPress={() => { viewerRevealed.add(element.id); setShown(true); playViewerVideo(element); }} accessibilityRole="button">
            <Text style={styles.veilButtonText}>查看</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ViewerImage({ element, width, blurred }: { element: Element; width: number; blurred: boolean }) {
  const sources = viewerImageSources(element, width);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [element.id]);
  const placeholder = tileImageUrl(element, width / 2, 1.5);
  return (
    <Image
      source={sources[i] ? { uri: sources[i] } : undefined}
      placeholder={placeholder ? { uri: placeholder } : element.blurHash ? { blurhash: element.blurHash } : undefined}
      placeholderContentFit="cover"
      contentFit="cover"
      blurRadius={blurred ? 42 : 0}
      recyclingKey={element.id}
      style={styles.fill}
      onError={() => setI((n) => (n + 1 < sources.length ? n + 1 : n))}
    />
  );
}

function ViewerVideo({ element }: { element: Element }) {
  const entry = useViewerVideo(element.id);
  return entry ? <ViewerVideoSurface key={entry.at} entry={entry} /> : null;
}

function ViewerVideoSurface({ entry }: { entry: ViewerVideoEntry }) {
  const active = useIsActiveViewerVideo(entry.id);
  const { player } = entry;
  const opacity = useSharedValue(entry.ready ? 1 : 0);
  useEffect(() => {
    const show = () => { opacity.value = 1; };
    if (entry.ready) show();
    entry.onReady.add(show);
    return () => { entry.onReady.delete(show); };
  }, [entry, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <>
      <Animated.View style={[styles.cover, style]} pointerEvents="none">
        <VideoView
          player={player}
          controls={false}
          pictureInPicture={false}
          autoEnterPictureInPicture={false}
          surfaceType="texture" // as VideoElement's VideoView: a texture, no picture in picture
          resizeMode="cover"
          style={styles.fill}
        />
      </Animated.View>
      {active ? <VideoScrubber player={player} /> : null}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  box: { alignSelf: 'center', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  link: { marginHorizontal: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.elevated },
  linkText: { ...theme.typography.largePlus, color: theme.colors.primary },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs },
  veilText: { ...theme.typography.caption, color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 6 },
  veilButton: { minHeight: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#00000066', justifyContent: 'center' },
  veilButtonText: { ...theme.typography.captionPlus, color: '#FFFFFF' },
}));
