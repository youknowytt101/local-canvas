// The phone's thermal state and Low Power Mode (ios/PowerStateModule.swift, android/.../PowerStateModule.kt): thermal on
// iOS's scale, 0 nominal, 1 fair, 2 serious, 3 critical. Without the native module (an old dev build) it reads as cool.
import { requireOptionalNativeModule } from 'expo';

export type PowerState = { thermal: 0 | 1 | 2 | 3; lowPower: boolean };

type PowerStateModule = {
  current(): PowerState;
  addListener(event: 'change', listener: (state: PowerState) => void): { remove: () => void };
};

const native = requireOptionalNativeModule<PowerStateModule>('PowerState');

export const currentPowerState = (): PowerState => native?.current() ?? { thermal: 0, lowPower: false };

export function watchPowerState(listener: (state: PowerState) => void): () => void {
  const sub = native?.addListener('change', listener);
  return () => sub?.remove();
}
