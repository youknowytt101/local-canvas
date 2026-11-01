// Cosmos keeps one navigation ref for code outside the screens (lib/explore/dismissGlobalSearchOverlays.js reads it)
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
