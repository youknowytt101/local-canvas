// When a player may be given its video. On Android a decoder draws into its view's Surface; a player given its video
// before that Surface exists starts on a placeholder and is moved over once it is there (MediaCodec.setOutputSurface).
// Some decoders get that move wrong: the emulator's goldfish H.264 draws black after it, so every video flickered
// (HANDOFF 6.159, 6.175: each decoder configured on the placeholder, then moved ~200 ms later), and media3 keeps a list
// of phones with the same fault. So on Android a player is put in its view first and given its video a few frames after
// the view is laid out (a TextureView makes its Surface the first time it is drawn): its decoder is made on the Surface
// it draws into and never moved. A player is never moved to another view either (a new view, a new player). iOS has no
// such step (an AVPlayerLayer takes its player whenever), so there players start at once.
import { Platform } from 'react-native';

export const SOURCE_AFTER_SURFACE = Platform.OS === 'android';
const SURFACE_FRAMES = 3; // laid out → mounted → drawn (the Surface made), and one to spare

// fn runs once the view laid out just now has been drawn
export function afterSurface(fn: () => void) {
  let left = SURFACE_FRAMES;
  const tick = () => {
    if (--left <= 0) fn();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
