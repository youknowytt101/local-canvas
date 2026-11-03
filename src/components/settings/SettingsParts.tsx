// The settings' parts (Cosmos' SettingsHeader, SettingsRow and buildSettingsListItems' groups):
//   - SettingsHeader: the way back, the title in the middle (headingMedium), something on the right (保存)
//   - SettingsGroup: a label (captionPlus, tertiary, 8 over the rows) and its rows on elevated, borderRadius.md, a
//     hairline between them (the web page's, 6.103)
//   - SettingsRow (module 3384, its styles read from the third restore): spacing.md all round; on the left the Icon
//     (22, primary) and the title (regularPlus, primary) sm apart; on the right, xs apart, a pill (pillLabel:
//     surfaceInverted, captionPlus in the background's colour, sm × 6, round), a status (statusLabel: 2 up, muted =
//     regular tertiary, alert = regularPlus alert) and the chevron (20, tertiary, at 0.7) unless hideChevron; pressed
//     it is a CustomPressable
//   - Field: a label (captionPlus, tertiary) over an input on elevated, borderRadius.md, 16 in, 48 high
import { useNavigation } from '@react-navigation/native';
import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CustomPressable } from '../CustomPressable';
import { HEADER_CONTENT_HEIGHT } from '../home/HomeHeader';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

export function SettingsHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_CONTENT_HEIGHT }]}>
      <Pressable style={styles.side} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}>
        <ChevronLeftIcon color={theme.colors.primary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

// 保存 and the like on the header's right
export function HeaderAction({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.action, disabled && styles.actionOff]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsGroup({ label, children }: { label?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.rows}>
        {rows.map((r, i) => <View key={i} style={i ? styles.divider : null}>{r}</View>)}
      </View>
    </View>
  );
}

export function SettingsRow({ label, Icon, statusLabel, statusVariant = 'muted', pillLabel, onPress, chevron = true, danger = false, note }: {
  label: string;
  Icon?: (p: { color: string; size?: number }) => ReactNode;
  statusLabel?: string | null;
  statusVariant?: 'muted' | 'alert';
  pillLabel?: string | null;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean; // sign out: the title in the alert colour
  note?: string; // under the title (this app's server rows)
}) {
  const { theme } = useUnistyles();
  return (
    <CustomPressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityRole="button">
      <View style={[styles.rowContent, styles.rowLeft]}>
        {Icon ? <Icon color={danger ? theme.colors.alert : theme.colors.primary} size={22} /> : null}
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, danger && styles.danger]} numberOfLines={1}>{label}</Text>
          {note ? <Text style={styles.note} numberOfLines={2}>{note}</Text> : null}
        </View>
      </View>
      <View style={[styles.rowContent, styles.rowRight]}>
        {pillLabel ? <View style={styles.pill}><Text style={styles.pillText}>{pillLabel}</Text></View> : null}
        {statusLabel ? <Text style={[styles.status, statusVariant === 'alert' ? styles.statusAlert : styles.statusMuted]} numberOfLines={1}>{statusLabel}</Text> : null}
        {chevron && onPress ? <View style={styles.chevron}><ChevronRightIcon color={theme.colors.tertiary} size={20} /></View> : null}
      </View>
    </CustomPressable>
  );
}

export function Field({ label, hint, hintTone, ...input }: TextInputProps & { label: string; hint?: string | null; hintTone?: 'ok' | 'error' | null }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={theme.colors.tertiary} {...input} style={[styles.input, input.multiline && styles.inputMulti, input.style]} />
      {hint ? <Text style={[styles.hint, hintTone === 'ok' && styles.hintOk, hintTone === 'error' && styles.danger]}>{hint}</Text> : null}
    </View>
  );
}

export function FormError({ text }: { text: string | null }) {
  return text ? <Text style={[styles.hint, styles.danger]}>{text}</Text> : null;
}

const styles = StyleSheet.create((theme) => ({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.background },
  side: { minWidth: 40, height: 40, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary, flex: 1, textAlign: 'center' },
  action: { ...theme.typography.largePlus, color: theme.colors.primary },
  actionOff: { color: theme.colors.disabled },
  group: { marginTop: 20 },
  label: { ...theme.typography.captionPlus, color: theme.colors.tertiary, marginBottom: theme.spacing.xs },
  rows: { borderRadius: theme.borderRadius.md, overflow: 'hidden', backgroundColor: theme.colors.elevated },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.background },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.md, width: '100%' },
  rowContent: { flexDirection: 'row', alignItems: 'center' },
  rowLeft: { gap: theme.spacing.sm, flex: 1, minWidth: 0 },
  rowRight: { gap: theme.spacing.xs, flexShrink: 1, marginLeft: theme.spacing.xs },
  rowText: { flexShrink: 1, minWidth: 0 },
  rowLabel: { ...theme.typography.regularPlus, color: theme.colors.primary },
  note: { ...theme.typography.caption, color: theme.colors.tertiary, marginTop: 2 },
  chevron: { opacity: 0.7 },
  pill: { paddingHorizontal: theme.spacing.sm, paddingVertical: 6, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceInverted },
  pillText: { ...theme.typography.captionPlus, color: theme.colors.background },
  status: { marginTop: -2, flexShrink: 1 },
  statusMuted: { ...theme.typography.regular, color: theme.colors.tertiary },
  statusAlert: { ...theme.typography.regularPlus, color: theme.colors.alert },
  danger: { color: theme.colors.alert },
  field: { marginTop: theme.spacing.md },
  input: {
    ...theme.typography.large, color: theme.colors.primary, minHeight: 48, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.elevated,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  hint: { ...theme.typography.caption, color: theme.colors.tertiary, marginTop: theme.spacing.xxs },
  hintOk: { color: theme.colors.secondary },
}));
