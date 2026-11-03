// Cosmos' SettingsScreen (SettingsRoot, no bar), its groups as useSettingsOptions / buildSettingsListItems make them,
// with the web page's words where 2.33's pack reads machine-translated (6.103):
//   - the avatar, the name and 编辑个人资料 (EditProfile); SettingHeaderCard: 所有元素 (AllElements) with "N 保存"
//     (settings.allElementsDescription) and the first four as a 2 × 2 preview (40 px, 1 px apart; as the content filter says)
//   - 一般 (settings.general): 账户详情 (GearIcon, AccountDetails, 更新密码 inside), 内容过滤 (EyeOffIcon,
//     ContentFiltering)
//   - 其他 (settings.other), in useSettingsOptions' order: 外观 (FilterIcon, its choice as a muted status;
//     AppearanceSheet: 系统 / 浅色 / 深色), 语言 (GlobalIcon, LanguageScreen), 触觉 (VoiceIcon, 开 / 关 as a muted status; HapticsSheet), 已屏蔽账号
//     (BlockedUserIcon, BlockedAccounts); both kept on the phone (lib/appearance)
//   - 登出 (SignOutIcon; settings.signOutConfirmTitle / Message, then sign out), the version under it
// Not in Cosmos, kept for this app (it reaches the computer's cosmos-lite): 电脑上的服务 — the address, 重试 when it
// cannot be reached, 改服务器地址. Not here (Cosmos has them, nothing here for them): 权限 (push, camera roll,
// contacts), premium, 联系我们 / 获取支持 / 加入社区 / 关注 Cosmos, language (the app is in Chinese only); nor the web
// page's 导入与同步 (no import page in the app), AI 分析, 个人资料 public / private, 举报审核 and 关闭账户.
// 触觉 is the 2.33 pack's word (settings.haptics); its 开 / 关 are this app's (the pack's 在 / 离开 are mistranslated).
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BlockedUserIcon, CheckIcon, ChevronRightIcon, DarkAppearanceIcon, EyeOffIcon, FilterIcon, GearIcon, GlobeIcon, LightAppearanceIcon, SignOutIcon, SystemAppearanceIcon, VerifiedProfileIcon, VoiceIcon } from '../../components/icons';
import { Avatar } from '../../components/profile/ProfileInfo';
import { SettingsGroup, SettingsHeader, SettingsRow } from '../../components/settings/SettingsParts';
import { SheetGrabber } from '../../components/sheets/SheetGrabber';
import { api, get } from '../../lib/api';
import { showToast } from '../../stores/useToastStore';
import type { Element } from '../../lib/elements';
import { APPEARANCES, getAppearance, setAppearance, setIsHapticsEnabled, SUPPORTED_LANGUAGES, useAppLanguage, useIsHapticsEnabled, type Appearance } from '../../lib/appearance';
import { absoluteUrl, serverUrl } from '../../lib/server';
import { Routes } from '../../navigation/routes';
import { useSessionStore } from '../../stores/useSessionStore';

const APPEARANCE_SHEET = 'appearance';
const HAPTICS_SHEET = 'haptics';
const HAPTICS_OPTIONS: [boolean, string][] = [[true, '开'], [false, '关']]; // HapticsSheet: settings.on / settings.off
export const TREATMENTS: [string, string][] = [['show', '显示'], ['blur', '模糊'], ['hide', '隐藏']];
export const treatmentLabel = (v?: string) => TREATMENTS.find(([k]) => k === v)?.[1] ?? '';

const previewUrl = (e: Element) => e.smallUrl || e.thumbUrl || e.posterSmallUrl || e.posterThumbUrl || (e.mediaKind === 'image' ? e.mediaUrl : e.posterUrl);

export function SettingsScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { me, offline, start, signOut, changeServer } = useSessionStore();
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance);
  const [all, setAll] = useState<{ count: number; items: Element[] } | null>(null);
  useFocusEffect(useCallback(() => {
    void get<{ items: Element[]; meta: { count?: number } }>('/api/elements?scope=all&pageSize=4').then((r) => setAll({ count: r.meta.count ?? r.items.length, items: r.items }), () => undefined);  }, []));

  const go = (name: string) => navigation.navigate(name);
  const confirmSignOut = () => Alert.alert('登出？', '确定要退出登录吗？', [
    { text: '取消', style: 'cancel' },
    { text: '登出', style: 'destructive', onPress: () => void signOut() },
  ]);
  const choose = (a: Appearance) => {
    setAppearance(a);
    setAppearanceState(a);
    void TrueSheet.dismiss(APPEARANCE_SHEET).catch(() => undefined);
  };
  const hapticsOn = useIsHapticsEnabled();
  const language = useAppLanguage();
  // not Cosmos': the local verified mark on one's own account (others': their profile's menu)
  const isAdmin = useSessionStore((x) => x.me?.adminRole === 'ADMIN');
  const myVerified = useSessionStore((x) => !!x.me?.verifiedProfile);
  const toggleMyVerified = async () => {
    const me = useSessionStore.getState().me;
    if (!me) return;
    try {
      const v = await api<{ verifiedProfile?: { name?: string } | null }>(myVerified ? 'DELETE' : 'POST', `/api/users/${encodeURIComponent(me.id)}/verified-profile`);
      useSessionStore.setState({ me: { ...me, verifiedProfile: v.verifiedProfile ?? null } });
    } catch (e) {
      showToast({ text: e instanceof Error ? e.message : '操作失败' });
    }
  };
  const chooseHaptics = (on: boolean) => {
    setIsHapticsEnabled(on);
    void TrueSheet.dismiss(HAPTICS_SHEET).catch(() => undefined);
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="设置" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xl }]}>
        {me ? (
          <Pressable style={({ pressed }) => [styles.meCard, pressed && styles.pressed]} onPress={() => go(Routes.EDIT_PROFILE)} accessibilityRole="button">
            <Avatar user={me} size={48} />
            <View style={styles.meText}>
              <Text style={styles.meName} numberOfLines={1}>{me.fullName || me.username}</Text>
              <Text style={styles.meSub}>编辑个人资料</Text>
            </View>
            <ChevronRightIcon color={theme.colors.tertiary} size={20} />
          </Pressable>
        ) : null}
        <Pressable style={({ pressed }) => [styles.meCard, styles.allCard, pressed && styles.pressed]} onPress={() => go(Routes.ALL_ELEMENTS)} accessibilityRole="button">
          <View style={styles.allPreview}>
            {[0, 1, 2, 3].map((i) => {
              const el = all?.items[i];
              const url = el && el.nsfw?.treatment !== 'hide' ? previewUrl(el) : null;
              return url
                ? <Image key={i} source={{ uri: absoluteUrl(url) }} style={styles.allCell} contentFit="cover" transition={120} blurRadius={el?.nsfw?.treatment === 'blur' ? 10 : 0} />
                : <View key={i} style={[styles.allCell, styles.allBlank]} />;
            })}
          </View>
          <View style={styles.meText}>
            <Text style={styles.meName} numberOfLines={1}>所有元素</Text>
            {all ? <Text style={styles.meSub}>{all.count} 保存</Text> : null}
          </View>
          <ChevronRightIcon color={theme.colors.tertiary} size={20} />
        </Pressable>
        <SettingsGroup label="一般">
          <SettingsRow Icon={GearIcon} label="账户详情" onPress={() => go(Routes.ACCOUNT_DETAILS)} />
          <SettingsRow Icon={EyeOffIcon} label="内容过滤" onPress={() => go(Routes.CONTENT_FILTERING)} />
        </SettingsGroup>
        <SettingsGroup label="其他">
          <SettingsRow Icon={FilterIcon} label="外观" statusLabel={APPEARANCES.find(([v]) => v === appearance)?.[1]}
            onPress={() => void TrueSheet.present(APPEARANCE_SHEET).catch(() => undefined)} />
          <SettingsRow Icon={GlobeIcon} label="语言" statusLabel={SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeLabel} onPress={() => go(Routes.LANGUAGE)} />
          <SettingsRow Icon={VoiceIcon} label="触觉" statusLabel={hapticsOn ? '开' : '关'}
            onPress={() => void TrueSheet.present(HAPTICS_SHEET).catch(() => undefined)} />
          <SettingsRow Icon={BlockedUserIcon} label="已屏蔽账号" onPress={() => go(Routes.BLOCKED_ACCOUNTS)} />
          {isAdmin ? <SettingsRow Icon={VerifiedProfileIcon} label={myVerified ? '取消我的认证' : '把我设为认证账户'} onPress={() => void toggleMyVerified()} /> : null}
        </SettingsGroup>
        <SettingsGroup label="电脑上的服务">
          <SettingsRow label={serverUrl() ?? ''} note={offline ? '连不上电脑上的服务' : undefined} chevron={false} />
          {offline ? <SettingsRow label="重试" onPress={() => void start()} chevron={false} /> : null}
          <SettingsRow label="改服务器地址" onPress={changeServer} chevron={false} />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow Icon={SignOutIcon} label="登出" onPress={confirmSignOut} />
        </SettingsGroup>
        <Text style={styles.version}>版本 {Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
      <TrueSheet name={APPEARANCE_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}>
        <SheetGrabber />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <Text style={styles.sheetTitle}>外观</Text>
          {APPEARANCES.map(([v, label]) => (
            <Pressable key={v} style={styles.sheetRow} onPress={() => choose(v)} accessibilityRole="button" accessibilityState={{ selected: v === appearance }}>
              <View style={styles.sheetRowLabel}>
                {v === 'system' ? <SystemAppearanceIcon color={theme.colors.primary} size={18} /> : v === 'light' ? <LightAppearanceIcon color={theme.colors.primary} size={18} /> : <DarkAppearanceIcon color={theme.colors.primary} size={18} />}
                <Text style={styles.sheetLabel}>{label}</Text>
              </View>
              {v === appearance ? <CheckIcon color={theme.colors.primary} size={20} /> : null}
            </Pressable>
          ))}
        </View>
      </TrueSheet>
      <TrueSheet name={HAPTICS_SHEET} detents={['auto']} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}>
        <SheetGrabber />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.md }]}>
          <Text style={styles.sheetTitle}>触觉</Text>
          {HAPTICS_OPTIONS.map(([on, label]) => (
            <Pressable key={label} style={styles.sheetRow} onPress={() => chooseHaptics(on)} accessibilityRole="button" accessibilityState={{ selected: on === hapticsOn }}>
              <Text style={styles.sheetLabel}>{label}</Text>
              {on === hapticsOn ? <CheckIcon color={theme.colors.primary} size={20} /> : null}
            </Pressable>
          ))}
        </View>
      </TrueSheet>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs },
  meCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.elevated,
  },
  allCard: { marginTop: theme.spacing.xs },
  allPreview: { width: 81, height: 81, flexDirection: 'row', flexWrap: 'wrap', gap: 1, borderRadius: theme.borderRadius.sm, overflow: 'hidden' },
  allCell: { width: 40, height: 40 },
  allBlank: { backgroundColor: theme.colors.background },
  pressed: { opacity: 0.6 },
  meText: { flex: 1, minWidth: 0 },
  meName: { ...theme.typography.largePlus, color: theme.colors.primary },
  meSub: { ...theme.typography.regular, color: theme.colors.tertiary },
  version: { ...theme.typography.caption, color: theme.colors.tertiary, textAlign: 'center', marginTop: theme.spacing.xl },
  sheet: { paddingHorizontal: theme.spacing.md },
  sheetTitle: { ...theme.typography.largePlus, color: theme.colors.primary, textAlign: 'center', marginBottom: theme.spacing.md },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: theme.spacing.xs },
  sheetRowLabel: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  sheetLabel: { ...theme.typography.large, color: theme.colors.primary },
}));
