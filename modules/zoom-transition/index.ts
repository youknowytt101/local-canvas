// iOS 18's zoom transition for a pushed screen (ios/ZoomTransitionModule.swift). Not there on Android or before iOS 18:
// zoomTransition is null, and callers do something else.
import { requireOptionalNativeModule } from 'expo';

type ZoomTransitionModule = {
  isAvailable(): boolean;
  arm(viewerId: string, sourceId: string, mediaId: string): void;
  setTarget(viewerId: string, sourceId: string | null, mediaId: string | null): void;
  forget(viewerId: string): void;
};

const native = requireOptionalNativeModule<ZoomTransitionModule>('ZoomTransition');

export const zoomTransition: ZoomTransitionModule | null = native?.isAvailable() ? native : null;
