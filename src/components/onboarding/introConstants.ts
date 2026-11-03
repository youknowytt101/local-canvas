// Cosmos' INTRO_STEP3_START_DELAY_MS module. The picture files are Cosmos', so they are not in this public repository: the
// computer's service has them under /public/onboarding/, as it has the fonts.
import * as Haptics from 'expo-haptics';
import { triggerImpactFeedback, triggerSelectionFeedback } from '../../lib/appearance';
import { absoluteUrl } from '../../lib/server';

export const INTRO_FLASH_CUT_DURATION_MS = 2000;
export const INTRO_FLASH_CUT_LOGO_LEAD_MS = 50;
export const INTRO_FLASH_CUT_EXIT_DURATION_MS = 100;
export const INTRO_FLASH_CUT_EXIT_SCALE = 0.85;
export const INTRO_TILE_EXPLOSION_DURATION_MS = 1200;
export const INTRO_VIDEO_HAPTIC_INTERVAL_MS = 100;
export const INTRO_VIDEO_HAPTIC_EXTENSION_MS = 100;
export const INTRO_EXPLOSION_GHOST_NOTE_LEAD_MS = 100;
// the logo animation's own length: (op 197 − ip 0) / fr 60
export const INTRO_LOTTIE_DURATION_MS = Math.round((197 / 60) * 1000);
export const INTRO_STEP3_START_DELAY_MS = Math.max(0, INTRO_LOTTIE_DURATION_MS - 1850);

export const introAsset = (file: string) => absoluteUrl(`/public/onboarding/${file}`);

// lib/onboarding/playIntroScatteredRevealPulse
export const playIntroVideoBeat = () => triggerSelectionFeedback();
export const playIntroExplosionGhostPulse = () => triggerSelectionFeedback();
export const playIntroExplosionImpactPulse = () => triggerImpactFeedback(Haptics.ImpactFeedbackStyle.Medium);
export const playIntroScatteredRevealPulse = () => triggerImpactFeedback(Haptics.ImpactFeedbackStyle.Soft);
