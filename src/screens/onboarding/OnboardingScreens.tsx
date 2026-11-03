// Cosmos' steps after the account exists, with onboarding.age.* / gender.* / onboardingInterests.*:
//   - OnboardingStepHeader: 44 high, the way back and an empty side 60 wide, OnboardingProgressBar between them (80 × 6,
//     surfaceBorder, the fill primary, moving to the step's share)
//   - AgeScreenContent: 你今年多大？, one field (年龄), 继续; what the server says is wrong replaces the subtitle in alert
//   - GenderScreenContent: 选择你的性别, four selection Pills in the middle, md apart, size.xxl + spacing.xl over and
//     under them, spacing.xl at the sides (Pill's selection variant: choicePill 212 wide, 56 high, round, pillElevated
//     with a hairline and the small shadow, buttonLarge centred; chosen: primary, no outline, inverted words); pressing
//     one saves it and goes on
//   - OnboardingInterestsScreen: 请问您想看到什么？, InterestTags (44 high, round, largePlus, a 24 round icon: plus, chosen a
//     check on primary), and the continue button (56 high, round, primary, xl in): 选择 N with "n/3" on its right until
//     there are enough, then 继续; pressed too early it shakes (−8, 8, −6, 6, −3, 3, 0). Saved, the screen fades out in
//     300 ms into the app.
// Near Cosmos: the topics are the library's most common description terms in one list, not its sections of topic
// categories (6.106), and the subtitle says 推荐 for its 算法 as the web page does; the progress counts these three steps
// (its fill moves in 250 ms, Easing.inOut(Easing.ease)); Cosmos' Pill shadow is a dropShadow filter (Android only),
// here the same shadow as a boxShadow.
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AuthInput } from '../../components/AuthInput';
import { CheckIcon, ChevronLeftIcon, PlusIcon } from '../../components/icons';
import { OnboardingStep } from '../../components/onboarding/OnboardingStep';
import { OnboardingTitle } from '../../components/onboarding/OnboardingTitle';
import { api, get } from '../../lib/api';
import { Routes } from '../../navigation/routes';
import { useSessionStore } from '../../stores/useSessionStore';
import { showToast } from '../../stores/useToastStore';

const STEPS = 3;
const PROGRESS_DURATION_MS = 250; // OnboardingProgressBar: Easing.inOut(Easing.ease)
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function StepHeader({ step }: { step: number }) {
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const fill = useSharedValue((step - 1) / STEPS);
  useFocusEffect(useCallback(() => { fill.value = withTiming(step / STEPS, { duration: PROGRESS_DURATION_MS, easing: Easing.inOut(Easing.ease) }); }, [fill, step]));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {step > 1 ? (
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="返回" hitSlop={8}>
            <ChevronLeftIcon color={theme.colors.primary} size={20} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS, now: step }}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <View style={styles.headerSide} />
    </View>
  );
}

export function AgeScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [age, setAge] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = async () => {
    setBusy(true);
    try {
      await api('POST', '/api/me/age', { age });
      setError(null);
      navigation.navigate(Routes.GENDER);
    } catch (e) {
      setError(message(e, '无法保存你的年龄。请重试。'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <OnboardingStep
      header={<StepHeader step={1} />}
      title="你今年多大？"
      subtitle={error ?? '这将帮助我们管理您的 Feed'}
      subtitleColor={error ? 'alert' : 'default'}
      button={{ text: '继续', onPress: () => void next(), disabled: !age.trim(), loading: busy }}
    >
      <AuthInput value={age} onChangeText={(v) => setAge(v.replace(/\D/g, ''))} placeholder="年龄" keyboardType="number-pad" maxLength={3} autoFocus />
    </OnboardingStep>
  );
}

const GENDERS: [string, string][] = [['WOMAN', '女性'], ['MAN', '男性'], ['NON_BINARY', '非二元性别'], ['PREFER_NOT_TO_SAY', '不愿透露']];

export function GenderScreen() {
  const { theme } = useUnistyles();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const choose = async (gender: string) => {
    setChosen(gender);
    setBusy(true);
    setError(false);
    try {
      await api('POST', '/api/me/gender', { gender });
      navigation.navigate(Routes.ONBOARDING_INTERESTS);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StepHeader step={2} />
      <OnboardingTitle title="选择你的性别" subtitle={error ? '无法保存你的选择。请重试。' : '我们用此信息为你定制推荐内容。\n此信息不会公开显示。'} subtitleColor={error ? 'alert' : 'default'} />
      <ScrollView contentContainerStyle={styles.pills}>
        {GENDERS.map(([value, label]) => {
          const on = chosen === value;
          return (
            <Pressable key={value} style={[styles.pill, on && styles.pillOn]} disabled={busy} onPress={() => void choose(value)}
              accessibilityRole="button" accessibilityState={{ selected: on, disabled: busy }}>
              {on && busy ? <ActivityIndicator size="small" color={theme.colors.inverted} /> : <Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

type Topics = { required: number; selected: string[]; items: { id: string; name: string }[] };

export function OnboardingInterestsScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const finish = useSessionStore((s) => s.start);
  const [topics, setTopics] = useState<Topics | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const opacity = useSharedValue(1);
  const shake = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const load = useCallback(() => {
    setFailed(false);
    void get<Topics>('/api/topics').then((t) => { setTopics(t); setPicked(new Set(t.selected)); }, () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const required = topics?.required ?? 3;
  const left = topics && topics.items.length >= required ? Math.max(required - picked.size, 0) : 0;
  const toggle = (id: string) => setPicked((p) => {
    const next = new Set(p);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const go = async () => {
    if (left) {
      shake.value = withSequence(...[-8, 8, -6, 6, -3, 3, 0].map((offset, i) => withTiming(offset, { duration: i ? 60 : 40 })));
      return;
    }
    setBusy(true);
    try {
      await api('POST', '/api/me/topics', { select: [...picked], unselect: (topics?.selected ?? []).filter((t) => !picked.has(t)) });
      await api('POST', '/api/me/onboarded');
      opacity.value = withTiming(0, { duration: 300 }, (done) => { if (done) runOnJS(finish)(); });
    } catch (e) {
      setBusy(false);
      showToast({ text: message(e, '无法保存你的选择。请重试。') });
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Animated.View style={[styles.screen, fadeStyle]}>
        <StepHeader step={3} />
        <OnboardingTitle title="请问您想看到什么？" subtitle={'你的推荐会随着你的使用而变化，\n这只是为了让您开始'} />
        {failed ? (
          <Pressable style={styles.center} onPress={load} accessibilityRole="button"><Text style={styles.errorText}>目前无法加载主题。 请再试一次。</Text></Pressable>
        ) : !topics ? (
          <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.tertiary} /></View>
        ) : (
          <ScrollView style={styles.screen} contentContainerStyle={styles.tags}>
            {topics.items.map((t) => {
              const on = picked.has(t.id);
              return (
                <Pressable key={t.id} style={[styles.tag, on && styles.tagOn]} onPress={() => toggle(t.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[styles.tagText, on && styles.tagTextOn]}>{t.name}</Text>
                  <View style={[styles.tagIcon, on && styles.tagIconOn]}>
                    {on ? <CheckIcon color={theme.colors.inverted} size={16} /> : <PlusIcon color={theme.colors.primary} size={16} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <Animated.View style={shakeStyle}>
            <Pressable style={styles.continue} disabled={busy || !topics} onPress={() => void go()} accessibilityRole="button">
              {busy ? <ActivityIndicator size="small" color={theme.colors.inverted} style={styles.continueBusy} /> : (
                <>
                  <Text style={styles.continueText}>{left ? `选择${left}` : '继续'}</Text>
                  {left ? <Text style={styles.continueText}>{picked.size}/{required}</Text> : null}
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.xs },
  headerSide: { width: 60, height: 40, justifyContent: 'center', alignItems: 'center' },
  track: { width: theme.progressBar.width, height: theme.progressBar.height, borderRadius: theme.progressBar.height, backgroundColor: theme.colors.surfaceBorder, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: theme.progressBar.height, backgroundColor: theme.colors.primary },
  pills: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.size.xxl + theme.spacing.xl, paddingHorizontal: theme.spacing.xl },
  pill: {
    justifyContent: 'center', alignItems: 'center', width: theme.choicePill.width, maxWidth: '100%', minHeight: theme.choicePill.minHeight, paddingHorizontal: theme.choicePill.paddingHorizontal,
    borderRadius: theme.borderRadius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.pillElevated, boxShadow: theme.shadows.small,
  },
  pillOn: { backgroundColor: theme.colors.primary, borderColor: 'transparent' },
  pillText: { ...theme.typography.buttonLarge, color: theme.colors.primary, textAlign: 'center' },
  pillTextOn: { color: theme.colors.inverted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.xl },
  errorText: { ...theme.typography.large, color: theme.colors.tertiary, textAlign: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, paddingTop: theme.spacing.xl, paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingLeft: theme.spacing.md, paddingRight: theme.spacing.sm, height: 44,
    borderRadius: theme.borderRadius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.pillElevated,
  },
  tagOn: { backgroundColor: theme.colors.primary },
  tagText: { ...theme.typography.largePlus, color: theme.colors.primary },
  tagTextOn: { color: theme.colors.inverted },
  tagIcon: { width: 24, height: 24, borderRadius: theme.borderRadius.full, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.elevated },
  tagIconOn: { backgroundColor: theme.colors.paperInvertedFilled },
  footer: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md },
  continue: {
    height: 56, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  continueBusy: { flex: 1 },
  continueText: { ...theme.typography.largePlus, color: theme.colors.inverted },
}));
