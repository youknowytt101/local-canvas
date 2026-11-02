// Cosmos' Sheet.Grabber (components/analytics/SheetGrabber.js): the sheets' grabber is part of their content, not the
// native one drawn over it — 37 × 4, rounded 2.5, surfaceBorder, spacing.xs over it and spacing.sm under it. Every
// sheet here draws it first and turns TrueSheet's own off (grabber={false}).
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export function SheetGrabber() {
  return <View style={styles.grabber} />;
}

const styles = StyleSheet.create((theme) => ({
  grabber: { width: 37, height: 4, backgroundColor: theme.colors.surfaceBorder, borderRadius: 2.5, alignSelf: 'center', marginTop: theme.spacing.xs, marginBottom: theme.spacing.sm },
}));
