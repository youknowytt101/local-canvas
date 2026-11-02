// A tile of a grid (Cosmos' MasonryGrid tile: tileInner — elevated, borderRadius.element (3), a hairline
// surfaceBorder outline, clipped — around ElementMedia), as wide as its column:
//   - a picture (an image, a video's cover, a GIF's still) as tall as its shape says (tileRatio), over its blurHash
//     (or its colour) while it loads; the content fades in over 300 ms (FadeIn.duration(300))
//   - a note: NoteElement compact (its Markdown, at most 18 % of the screen high, centred, cut off)
//   - a link without a picture: its title (and a picture when there is one)
// Content filtering: a picture whose treatment is 'blur' is blurred under a veil saying what it is, with 查看
// (cosmos-lite's ContentFilterPill: at least 32 high, a 16 corner, #00000066, white); 查看 shows it for this session.
// The grid's tiles do not scale when pressed (scaleOnLongPress false: PlainPressableContainer); a long press gives a
// light haptic and opens the save sheet (useElementMoveLongPress). Pressing opens the viewer.
// A video plays its preview, silent and looping, over its picture when lib/gridVideos says so: the web page's grids, by
// the person's choice (HANDOFF 6.169). Cosmos' do not play (MasonryGrid passes allowVideoPlayback false to ElementMedia).
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { canvasVideoUrls } from '../../lib/canvas/layout';
import { NSFW_VEIL, originalImageUrl, tileImageUrl, tileRatio, type Element } from '../../lib/elements';
import { watchGridVideo, type GridVideoState } from '../../lib/gridVideos';
import { absoluteUrl } from '../../lib/server';
import { prewarmViewerVideo } from '../../lib/viewerVideoPlayers';
import { useMoveSheetStore } from '../../stores/useMoveSheetStore';
import { NoteElement } from './NoteElement';
import { PreviewVideo } from './PreviewVideo';

const revealed = new Set<string>(); // 查看 pressed: shown as it is until the app is closed

function GridVideo({ element }: { element: Element }) {
  const view = useRef<View>(null);
  const focused = useIsFocused();
  const [state, setState] = useState<GridVideoState>('off');
  const lane = element.previewUrl ? 'preview' : 'original';
  useEffect(() => {
    if (!focused) return undefined;
    const stop = watchGridVideo(lane, (done) => view.current?.measureInWindow(done), setState);
    return () => { stop(); setState('off'); };
  }, [focused, lane]);
  return (
    <View ref={view} style={RNStyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
      {state === 'playing' ? <PreviewVideo urls={canvasVideoUrls(element).map((u) => absoluteUrl(u))} playing /> : null}
    </View>
  );
}

type Props = {
  element: Element;
  width: number;
  imageScale: number;
  onMediaReady?: (id: string) => void;
  onPress?: (element: Element) => void;
};

export const ElementTile = memo(function ElementTile({ element, width, imageScale, onMediaReady, onPress }: Props) {
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(revealed.has(element.id));
  const url = failed ? originalImageUrl(element) : tileImageUrl(element, width, imageScale);
  const blurred = element.nsfw?.treatment === 'blur' && !shown;
  const ready = () => onMediaReady?.(element.id);

  let content;
  if (element.type === 'note') {
    content = <NoteElement text={element.text ?? ''} compact onLayout={ready} />;
  } else if (url) {
    const ratio = element.mediaKind === 'video' && !element.width ? 9 / 16 : tileRatio(element.width, element.height);
    content = (
      <View style={{ width: '100%', aspectRatio: ratio, backgroundColor: element.color ?? undefined }}>
        <Image
          source={{ uri: url }}
          placeholder={element.blurHash ? { blurhash: element.blurHash } : undefined}
          contentFit="cover"
          transition={0}
          blurRadius={blurred ? 30 : 0}
          recyclingKey={element.id}
          style={styles.media}
          onLoad={ready}
          onError={() => { if (!failed) setFailed(true); else ready(); }}
        />
        {element.mediaKind === 'video' && !blurred && canvasVideoUrls(element).length ? <GridVideo key={element.id} element={element} /> : null}
        {blurred ? (
          <View style={styles.veil}>
            <Text style={styles.veilText}>{NSFW_VEIL[element.nsfw!.status]}</Text>
            <Pressable style={styles.veilButton} onPress={() => { revealed.add(element.id); setShown(true); }} accessibilityRole="button">
              <Text style={styles.veilButtonText}>查看</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  } else {
    content = (
      <View style={styles.bare} onLayout={ready}>
        <Text style={styles.title} numberOfLines={3}>{element.title || '没有标题'}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPressIn={element.mediaKind === 'video' ? () => prewarmViewerVideo(element) : undefined}
      onPress={() => onPress?.(element)}
      onLongPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); useMoveSheetStore.getState().open(element); }}
      accessibilityRole="button"
      accessibilityLabel={element.title || undefined}
    >
      <Animated.View entering={FadeIn.duration(300)} style={styles.tileInner}>{content}</Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create((theme) => ({
  tileInner: {
    backgroundColor: theme.colors.elevated, borderRadius: theme.borderRadius.element, borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.surfaceBorder, overflow: 'hidden', position: 'relative',
  },
  media: { width: '100%', height: '100%' },
  bare: { padding: theme.spacing.sm, minHeight: 80, justifyContent: 'flex-end' },
  title: { ...theme.typography.regularPlus, color: theme.colors.primary },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xs },
  veilText: { ...theme.typography.caption, color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 6 },
  veilButton: { minHeight: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#00000066', justifyContent: 'center' },
  veilButtonText: { ...theme.typography.captionPlus, color: '#FFFFFF' },
}));
