// Cosmos' canvas constants (ATLAS_IMAGE_CANCEL_POLL_MS.js, the constants module, taken in export order; resetInteractionState,
// createCanvasPanGesture, createCanvasLongPressGesture, useCanvasPressFocus, getCanvasOpenPillItems, CanvasOpenPillOverlay,
// useInitialCanvasReveal, InfiniteCanvas). The web page's public/board.js has the same numbers (HANDOFF 6.33–6.36).
import { Platform } from 'react-native';
import { IS_ANDROID_EMULATOR } from '../gridVideos';
export const CANVAS = {
  PAGE_SIZE: 120,
  MAX_RENDER_ELEMENTS: 2880,
  WARM_RENDER_PAGE_COUNT: 4,
  PAGINATION_DISTANCE: 200,
  COLUMN_COUNT: 9,
  VISIBLE_COLUMN_COUNT: 4,
  WORLD_GAP: 6,
  VIEWPORT_PADDING_RATIO: 0.5,
  MIN_SCALE: 0.55,
  INITIAL_SCALE: 1,
  MAX_SCALE: 3.25,
  OPEN_VIEWER_ARM_SCALE: 3,
  OPEN_VIEWER_SCALE: 4.1,
  OPEN_VIEWER_TRIGGER_SCALE: 4.4,
  OPEN_VIEWER_BACKGROUND_MIN_OPACITY: 0.16,
  // resetInteractionState
  TIMING_MS: 260, // Easing.out(Easing.cubic)
  ZOOM_OPEN_RETURN_MS: 240, // Easing.bezier(0.22, 1, 0.36, 1)
  PAN_DECAY_RATE: 0.18,
  PAN_VELOCITY_FACTOR: 1.25,
  PAN_STOP_VELOCITY: 4,
  ZOOM_DECAY_RATE: 0.0005,
  ZOOM_STOP_VELOCITY: 0.01,
  ZOOM_MAX_VELOCITY: 12,
  ZOOM_RELEASE_SAMPLE_MAX_AGE: 0.08,
  ZOOM_VELOCITY_SMOOTHING: 0.2,
  ZOOM_OPEN_RETURN_EPSILON: 0.5,
  ZOOM_RELEASE_DEAD_ZONE: 0.6,
  ZOOM_RELEASE_BASE_GAIN: 1.05,
  ZOOM_RELEASE_FAST_GAIN: 1.65,
  // createCanvasPanGesture / createCanvasLongPressGesture
  TAP_MAX_DISTANCE: 10,
  TAP_SUPPRESSION_PAN_VELOCITY: 40,
  TAP_SUPPRESSION_ZOOM_VELOCITY: 0.04,
  LONG_PRESS_MS: 180,
  // useCanvasPressFocus: the pressed card, spring 35 / 0.8 / 650 (damping / mass / stiffness)
  PRESS_SCALE: 0.975,
  // InfiniteCanvas / useInitialCanvasReveal
  REVEAL_BLUR: 24,
  REVEAL_MS: 1800, // Easing.bezier(0.16, 1, 0.3, 1)
  // getCanvasOpenPillItems / CanvasOpenPillOverlay
  OPEN_PILL_RENDER_LIMIT: 12,
  OPEN_PILL_SCALE: 2.5,
  OPEN_PILL_HIDE_SCALE: 2.32,
  OPEN_PILL_MOUNT_SCALE: 2.15,
  OPEN_PILL_WIDTH: 58,
  OPEN_PILL_HEIGHT: 30,
  OPEN_PILL_INSET: 10,
  OPEN_PILL_FADE_MS: 140,
  // createCanvasItemInstance
  RENDER_SLOT_CACHE_LIMIT: 4096,
  // useCanvasCulling
  CULLING_BUCKET_SIZE: 280,
  CULLING_SCALE_BUCKET_SIZE: 0.15,
  // useInfiniteCanvasRenderState
  PRIORITY_ATLAS_ITEM_COUNT: 160,
  REVEAL_REQUIRED_ITEM_COUNT: 16,
  IMAGE_REQUEST_DEBOUNCE_MS: 100,
  // buildAtlasGenerationPages / disposeAtlasPages / yieldToJs
  PRIORITY_IMAGE_ATLAS_PAGE_ITEM_LIMIT: 12,
  PRIORITY_ATLAS_IMAGE_PAGE_CONCURRENCY: 12,
  BACKGROUND_IMAGE_ATLAS_PAGE_ITEM_LIMIT: 6,
  BACKGROUND_ATLAS_IMAGE_PAGE_CONCURRENCY: 2,
  REUSABLE_PAGE_COUNT: 6,
  ATLAS_IMAGE_CANDIDATE_LIMIT: 1,
  ATLAS_IMAGE_CONCURRENCY: 4,
  ATLAS_IMAGE_LOAD_TIMEOUT_MS: 2500,
  ATLAS_IMAGE_CANCEL_POLL_MS: 32,
  IMAGE_FAILURE_SUPPRESS_MS: 60000,
  // packAtlasItems
  ATLAS_MAX_SIZE: 2048,
  ATLAS_SPRITE_WIDTH: 400,
  ATLAS_PADDING: 2,
  // InfiniteCanvasScreen: the seed history keeps this many
  SEED_HISTORY_LIMIT: 5,
  // Not in Cosmos (videos play on the canvas by the person's choice, HANDOFF 6.130, 6.165). Two tiers:
  //   - every video on screen, moving or not, loops its strip of first frames (StripCard): a texture each, no decoder.
  //     At most STRIP_MAX, the nearest the middle; the textures kept are STRIP_CACHE
  //   - at rest, the ones nearest the middle with this much of them in view also get a real player over the strip,
  //     so many from each lane (the web page's PLAY_BUDGET, syncPlayback), a few new ones at a time. Smaller than the web
  //     page's 20 / 2: every one is a player and a decoder of its own on a phone. The Android emulator's previews decode
  //     in software (its H.264 hardware allows 4 at a time), so its number is what its 4 cores can carry
  STRIP_FPS: 8, // what derive.js makes them at
  STRIP_MAX: 32,
  STRIP_CACHE: 48,
  VIDEO_PLAY_BUDGET: Platform.OS === 'ios' ? { preview: 12, original: 1 } : IS_ANDROID_EMULATOR ? { preview: 8, original: 1 } : { preview: 6, original: 1 },
  VIDEO_START_BATCH: 2,
  VIDEO_START_GAP_MS: 120,
  // the new ones start this long after the camera rests, the ones that stopped having let go of their decoders by then
  // (the web page waits SETTLE_MS for a scroll to settle)
  VIDEO_SETTLE_MS: 150,
  VIDEO_VISIBLE_FRACTION: 0.25,
} as const;
