// Cosmos' LanguageScreen (routes.Language) and getSupportedLanguageByCode: 语言 over English on its own, 推荐 (the phone's
// languages, English aside) and 其他 (the rest), each a rounded list of rows (at least 60 high): the language's own name, its
// English name (tertiary) and a tick (20) on the chosen one.
// Not as in Cosmos, by the person's choice (HANDOFF 6.190): the choice is only remembered and shown here and on the settings
// row; the words of the app stay Chinese, which is what is chosen until another is. Near Cosmos: "the phone's languages" is
// the one Intl gives (Cosmos has all of expo-localization's).
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { CustomPressable } from '../../components/CustomPressable';
import { CheckIcon } from '../../components/icons';
import { SettingsHeader } from '../../components/settings/SettingsParts';
import { setAppLanguage, SUPPORTED_LANGUAGES, useAppLanguage, type SupportedLanguage } from '../../lib/appearance';

function suggestedLanguages(): SupportedLanguage[] {
  const code = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0]?.toLowerCase();
  return SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en' && l.code === code);
}

function LanguageList({ languages, selected }: { languages: SupportedLanguage[]; selected: string }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.list}>
      {languages.map((l, i) => (
        <View key={l.code}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <CustomPressable haptics={false} style={styles.optionRow} onPress={() => setAppLanguage(l.code)} accessibilityState={{ selected: l.code === selected }}>
            <View style={styles.labelContainer}>
              <Text style={styles.nativeLabel}>{l.nativeLabel}</Text>
              <Text style={styles.englishLabel}>{l.englishLabel}</Text>
            </View>
            {l.code === selected ? <CheckIcon color={theme.colors.primary} size={20} /> : <View style={styles.checkPlaceholder} />}
          </CustomPressable>
        </View>
      ))}
    </View>
  );
}

export function LanguageScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const selected = useAppLanguage();
  const { english, suggested, other } = useMemo(() => {
    const near = suggestedLanguages();
    const nearCodes = new Set(near.map((l) => l.code));
    return {
      english: SUPPORTED_LANGUAGES.filter((l) => l.code === 'en'),
      suggested: near,
      other: SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en' && !nearCodes.has(l.code)),
    };
  }, []);
  return (
    <View style={styles.container}>
      <SettingsHeader title="语言" backgroundColor={theme.colors.elevated} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <LanguageList languages={english} selected={selected} />
        {suggested.length ? (
          <>
            <Text style={styles.sectionTitle}>推荐</Text>
            <LanguageList languages={suggested} selected={selected} />
          </>
        ) : null}
        <Text style={styles.sectionTitle}>其他</Text>
        <LanguageList languages={other} selected={selected} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: { flex: 1, backgroundColor: theme.colors.elevated },
  scrollView: { flex: 1, paddingHorizontal: theme.spacing.md },
  content: { marginTop: theme.spacing.xl },
  list: { backgroundColor: rt.themeName === 'dark' ? theme.colors.elevated : theme.colors.background, borderRadius: theme.spacing.xl },
  sectionTitle: { ...theme.typography.captionPlus, color: theme.colors.tertiary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs, marginLeft: theme.spacing.md },
  optionRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  labelContainer: { flex: 1, gap: 2, paddingRight: theme.spacing.md },
  nativeLabel: { ...theme.typography.regularPlus, color: theme.colors.primary },
  englishLabel: { ...theme.typography.regular, color: theme.colors.tertiary },
  checkPlaceholder: { width: 20, height: 20 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder },
}));
