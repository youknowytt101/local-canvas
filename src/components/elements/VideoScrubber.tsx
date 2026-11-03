// Cosmos' VideoScrubber (module 2406), all the controls a video has in the viewer (VideoView's own are off):
//   - a thin line along the bottom edge: white over 30 % white, moving with the playback
//   - dragging it (minDistance 8, sideways): the line thickens over 200 ms, a gradient comes up (transparent to 25 %
//     black) with the two times (formatTime, caption, white), the video pauses and follows; let go, the gradient goes at
//     once and the line and the times SCRUB_HIDE_MS later
//   - a tap: sound on / off, a long press (300 ms): paused while held; each shows VideoActionFeedback (a 48 round pill)
// Near Cosmos: the line's hit area is inside the video (Cosmos' hangs below it, VIDEO_SCRUBBER_EDGE_OVERFLOW); no
// 该视频没有音频 pill (the player does not say what tracks it has) and the volume keys do not turn the sound on
// (useAndroidVolumeUnmute); the thick line's height and the feedback's timing are close, not read.
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet as RNStyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { MuteIcon, PauseIcon, PlayIcon, UnmuteIcon } from '../icons';
import { StyleSheet } from 'react-native-unistyles';
import { isViewerMuted, setViewerMuted } from '../../lib/viewerVideoPlayers';

const TRACK_HEIGHT = 1;
const TRACK_HEIGHT_EXPANDED = 6;
const TRACK_HIT_AREA = 44;
const SCRUB_HIDE_MS = 1000;
const LONG_PRESS_MS = 300;
const TICK_MS = 250; // the player's timeUpdate events

export const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

type Feedback = 'muted' | 'unmuted' | 'paused' | 'resumed';

function FeedbackIcon({ kind }: { kind: Feedback }) {
  const Icon = { paused: PauseIcon, resumed: PlayIcon, muted: MuteIcon, unmuted: UnmuteIcon }[kind];
  return <Icon color="#FFFFFF" size={24} />;
}

export function VideoScrubber({ player }: { player: VideoPlayer }) {
  const [feedback, setFeedback] = useState<{ kind: Feedback; n: number } | null>(null);
  const [width, setWidth] = useState(0);
  const [durationText, setDurationText] = useState('0:00');
  const [timeText, setTimeText] = useState('0:00');
  const scrubbing = useRef(false);
  const seq = useRef(0);

  const progress = useSharedValue(0);
  const duration = useSharedValue(0);
  const trackHeight = useSharedValue(TRACK_HEIGHT);
  const gradientOpacity = useSharedValue(0);
  const labelsOpacity = useSharedValue(0);
  const labelsY = useSharedValue(2);
  const feedbackOpacity = useSharedValue(0);
  const feedbackScale = useSharedValue(0.8);

  const setLength = useCallback((d: number) => {
    if (!Number.isFinite(d) || d <= 0) return;
    duration.value = d;
    setDurationText(formatTime(d));
  }, [duration]);
  // the player says where it is every TICK_MS while this page is on screen, and not at all otherwise
  useEffect(() => {
    player.timeUpdateEventInterval = TICK_MS / 1000;
    setLength(player.duration);
    return () => { player.timeUpdateEventInterval = 0; };
  }, [player, setLength]);
  useEventListener(player, 'sourceLoad', (data) => setLength(data.duration));
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (scrubbing.current) return;
    if (duration.value <= 0) setLength(player.duration);
    if (duration.value <= 0) return;
    const next = Math.min(currentTime / duration.value, 1);
    // looping back to the start jumps; otherwise it glides to the next event
    progress.value = next < progress.value ? next : withTiming(next, { duration: TICK_MS, easing: Easing.linear });
  });

  const show = (kind: Feedback) => {
    seq.current += 1;
    setFeedback({ kind, n: seq.current });
    feedbackScale.value = 0.8;
    feedbackScale.value = withTiming(1, { duration: 150 });
    feedbackOpacity.value = withSequence(withTiming(1, { duration: 100 }), withDelay(600, withTiming(0, { duration: 200 })));
  };
  const onTap = () => {
    const next = !isViewerMuted();
    setViewerMuted(next);
    show(next ? 'muted' : 'unmuted');
  };
  const onHoldStart = () => { player.pause(); show('paused'); };
  const onHoldEnd = () => { player.play(); show('resumed'); };
  const onScrubBegin = () => { scrubbing.current = true; player.pause(); };
  const onScrubEnd = () => { scrubbing.current = false; player.play(); };
  const seekTo = (seconds: number) => { player.currentTime = seconds; setTimeText(formatTime(seconds)); };

  const tap = Gesture.Tap().maxDistance(12).onEnd((_e, ok) => { if (ok) runOnJS(onTap)(); });
  const hold = Gesture.LongPress().minDuration(LONG_PRESS_MS).maxDistance(20)
    .onStart(() => { runOnJS(onHoldStart)(); })
    .onFinalize((_e, ok) => { if (ok) runOnJS(onHoldEnd)(); });
  const surface = Gesture.Exclusive(hold, tap);

  const scrub = Gesture.Pan().minDistance(8).activeOffsetX([-8, 8]).failOffsetY([-20, 20])
    .onBegin((e) => {
      if (width <= 0 || duration.value <= 0) return;
      cancelAnimation(labelsOpacity);
      cancelAnimation(labelsY);
      trackHeight.value = withTiming(TRACK_HEIGHT_EXPANDED, { duration: 200 });
      gradientOpacity.value = withTiming(1, { duration: 200 });
      labelsOpacity.value = 1;
      labelsY.value = 0;
      const ratio = Math.max(0, Math.min(1, e.x / width));
      progress.value = ratio;
      runOnJS(onScrubBegin)();
      runOnJS(seekTo)(ratio * duration.value);
    })
    .onUpdate((e) => {
      if (width <= 0 || duration.value <= 0) return;
      const ratio = Math.max(0, Math.min(1, e.x / width));
      progress.value = ratio;
      runOnJS(seekTo)(ratio * duration.value);
    })
    .onFinalize(() => {
      gradientOpacity.value = withTiming(0, { duration: 200 });
      trackHeight.value = withDelay(SCRUB_HIDE_MS, withTiming(TRACK_HEIGHT, { duration: 200 }));
      labelsOpacity.value = withDelay(SCRUB_HIDE_MS, withTiming(0, { duration: 200 }));
      labelsY.value = withDelay(SCRUB_HIDE_MS, withTiming(2, { duration: 200 }));
      runOnJS(onScrubEnd)();
    });

  const gradientStyle = useAnimatedStyle(() => ({ opacity: gradientOpacity.value }));
  const trackStyle = useAnimatedStyle(() => ({ height: trackHeight.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width, height: trackHeight.value }));
  const labelsStyle = useAnimatedStyle(() => ({ opacity: labelsOpacity.value, transform: [{ translateY: labelsY.value }] }));
  const feedbackStyle = useAnimatedStyle(() => ({ opacity: feedbackOpacity.value, transform: [{ scale: feedbackScale.value }] }));

  return (
    <View style={RNStyleSheet.absoluteFill} testID="video-controls">
      <GestureDetector gesture={surface}>
        <View style={RNStyleSheet.absoluteFill} />
      </GestureDetector>
      <Animated.View style={[styles.gradient, gradientStyle]} pointerEvents="none">
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)']} style={RNStyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.feedback} pointerEvents="none">
        <Animated.View style={[styles.actionPill, feedbackStyle]}>
          {feedback ? <FeedbackIcon key={feedback.n} kind={feedback.kind} /> : null}
        </Animated.View>
      </View>
      <Animated.View style={[styles.labels, labelsStyle]} pointerEvents="none">
        <Text style={styles.time}>{timeText}</Text>
        <Text style={styles.time}>{durationText}</Text>
      </Animated.View>
      <GestureDetector gesture={scrub}>
        <View style={styles.hit} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.track, trackStyle]} />
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  feedback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  actionPill: { width: 48, height: 48, borderRadius: theme.borderRadius.full, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.58)' },
  labels: { position: 'absolute', left: 0, right: 0, bottom: 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.sm },
  time: { ...theme.typography.caption, color: 'white' },
  hit: { position: 'absolute', left: 0, right: 0, bottom: 0, height: TRACK_HIT_AREA },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  fill: { position: 'absolute', left: 0, bottom: 0, backgroundColor: 'white' },
}));
