// The settings' own pages (SettingsNavigator), with the web page's fields, rules and words (6.103 / 6.106):
//   - EditProfile (EditProfileScreen): the avatar (picked from the phone, cropped on CropPictureScreen; 移除), 用户名 (whether it
//     is free is asked as it is typed, GetUsernameStatus), 全名, 简介 (240, counted), 网站, up to two of Instagram /
//     X / TikTok / Spotify; 保存 on the header's right (toast 个人资料已更新)
//   - AccountDetails (AccountDetailsScreen): 邮箱, 出生日期 (YYYY-MM-DD), 国家或地区 (a code such as CN); 保存; and
//     更新密码 under them
//   - UpdatePassword: 当前密码 (once there is one), 新密码, 确认新密码 — at least 8, the two the same (errors.*)
//   - ContentFiltering (ContentFilteringScreen, ContentFilterCategory): 露骨内容 and 暗示性内容, each 显示 / 模糊 / 隐藏,
//     and what the library has been sorted into. Near Cosmos: no AI content row and no age confirmation (as the web
//     page); the phone's lists show the new setting once they are read again
//   - BlockedAccounts: the accounts blocked, each with 解除屏蔽; none: 没有已屏蔽的账号
// Near Cosmos: the country is typed as its code (the web page lists the countries by name).
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/profile/ProfileInfo';
import { Field, FormError, HeaderAction, SettingsGroup, SettingsHeader, SettingsRow } from '../../components/settings/SettingsParts';
import { api, get } from '../../lib/api';
import { Routes } from '../../navigation/routes';
import { useSessionStore } from '../../stores/useSessionStore';
import { showToast } from '../../stores/useToastStore';
import { TREATMENTS } from './SettingsScreen';

type MeFull = {
  id: string; username: string; fullName?: string; avatarUrl?: string | null; bio?: string; websiteUrl?: string;
  socialLinks?: Record<string, string>; email?: string; birthday?: string; countryCode?: string; hasPassword?: boolean; isPremium?: boolean;
};
const SOCIALS: [string, string][] = [['instagram', 'Instagram'], ['x', 'X'], ['tiktok', 'TikTok'], ['spotify', 'Spotify']];
const MAX_BIO = 240;

// the session's own copy of the user (the header card, the profile) is told too
const meAgain = (me: MeFull) => useSessionStore.setState({ me: { ...useSessionStore.getState().me, ...me } });
const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const sessionAvatar = useSessionStore((x) => x.me?.avatarUrl);
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeFull | null>(null);
  const [form, setForm] = useState({ username: '', fullName: '', bio: '', website: '', social: {} as Record<string, string> });
  const [error, setError] = useState<string | null>(null);
  const [nameHint, setNameHint] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const ticket = useRef(0);
  const formScroll = useRef<KeyboardAwareScrollViewRef>(null);
  // the error is under the socials and 保存 is on the header: the form is taken down to it
  const fail = (text: string) => {
    setError(text);
    requestAnimationFrame(() => formScroll.current?.scrollToEnd());
  };

  useEffect(() => {
    void get<MeFull>('/api/me').then((m) => {
      setMe(m);
      setForm({ username: m.username, fullName: m.fullName ?? '', bio: m.bio ?? '', website: m.websiteUrl ?? '', social: { ...m.socialLinks } });
    }, (e) => setError(message(e, '读不到个人资料')));
  }, []);

  // onboarding.username.*: asked a moment after the typing stops
  const checkName = useCallback((name: string) => {
    const my = ++ticket.current;
    if (!name || name === me?.username) { setNameHint(null); return; }
    setTimeout(() => {
      if (my !== ticket.current) return;
      void get<{ isValid: boolean; isAvailable: boolean; isPremium: boolean }>(`/api/auth/username/status?username=${encodeURIComponent(name)}`).then((st) => {
        if (my !== ticket.current) return;
        const ok = st.isValid && st.isAvailable && (!st.isPremium || !!me?.isPremium);
        setNameHint({ ok, text: !st.isValid ? '请选择不同的用户名' : !st.isAvailable ? `${name} 不可用` : st.isPremium && !me?.isPremium ? `${name} 是高级用户名` : `${name} 可用` });
      }, () => undefined);
    }, 250);
  }, [me]);

  const save = async () => {
    const social = Object.fromEntries(SOCIALS.map(([k]) => [k, (form.social[k] ?? '').trim()]));
    if (Object.values(social).filter(Boolean).length > 2) { fail('最多添加 2 个社交'); return; }
    const body: Record<string, unknown> = { username: form.username.trim(), bio: form.bio, website: form.website.trim(), social };
    if (form.fullName.trim() || me?.fullName) body.fullName = form.fullName.trim();
    setBusy(true);
    try {
      meAgain(await api<MeFull>('POST', '/api/me/profile', body));
      showToast({ text: '个人资料已更新' });
      navigation.goBack();
    } catch (e) {
      fail(message(e, '无法更新个人资料'));
    } finally {
      setBusy(false);
    }
  };
  // the crop page has saved a new picture
  useEffect(() => {
    setMe((m) => (m && sessionAvatar !== undefined ? { ...m, avatarUrl: sessionAvatar } : m));
  }, [sessionAvatar]);
  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    navigation.navigate(Routes.CROP_PROFILE_PICTURE, { imageUri: r.assets[0].uri }); // it saves it, and the session's picture with it
  };
  const removePhoto = async () => {
    try {
      const m = await api<MeFull>('DELETE', '/api/me/photo');
      setMe(m);
      meAgain(m);
    } catch (e) {
      fail(message(e, '无法移除头像'));
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="编辑个人资料" right={<HeaderAction label="保存" onPress={() => void save()} disabled={!me || busy} />} />
      <KeyboardAwareScrollView ref={formScroll} bottomOffset={24} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {me ? (
          <>
            <View style={styles.avatarBlock}>
              <Pressable onPress={() => void pickPhoto()} accessibilityRole="button" accessibilityLabel="更换头像"><Avatar user={me} size={88} /></Pressable>
              <View style={styles.avatarActions}>
                <Button text="更换头像" variant="secondary" size="small" fitContent onPress={() => void pickPhoto()} />
                {me.avatarUrl ? <Button text="移除" variant="outline" size="small" fitContent onPress={() => void removePhoto()} /> : null}
              </View>
            </View>
            <Field label="用户名" value={form.username} autoCapitalize="none" autoCorrect={false}
              onChangeText={(v) => { setForm((f) => ({ ...f, username: v })); checkName(v.trim()); }}
              hint={nameHint?.text} hintTone={nameHint ? (nameHint.ok ? 'ok' : 'error') : null} />
            <Field label="全名" value={form.fullName} placeholder="你的名字" onChangeText={(v) => setForm((f) => ({ ...f, fullName: v }))} />
            <Field label="简介" value={form.bio} multiline maxLength={MAX_BIO} placeholder="介绍一下自己"
              onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))} hint={`${[...form.bio].length} / ${MAX_BIO}`} />
            <Field label="网站" value={form.website} placeholder="example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url"
              onChangeText={(v) => setForm((f) => ({ ...f, website: v }))} />
            {SOCIALS.map(([k, label]) => (
              <Field key={k} label={label} value={form.social[k] ?? ''} placeholder="用户名" autoCapitalize="none" autoCorrect={false}
                onChangeText={(v) => setForm((f) => ({ ...f, social: { ...f.social, [k]: v } }))} />
            ))}
            <Text style={styles.note}>社交最多填 2 个。</Text>
            <FormError text={error} />
          </>
        ) : error ? <FormError text={error} /> : <ActivityIndicator style={styles.loading} />}
      </KeyboardAwareScrollView>
    </View>
  );
}

export function AccountDetailsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<MeFull | null>(null);
  const [form, setForm] = useState({ email: '', birthday: '', countryCode: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void get<MeFull>('/api/me').then((m) => {
      setMe(m);
      setForm({ email: m.email ?? '', birthday: m.birthday ?? '', countryCode: m.countryCode ?? '' });
    }, (e) => setError(message(e, '读不到账户详情')));
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const m = await api<MeFull>('POST', '/api/me/account', { email: form.email.trim(), birthday: form.birthday.trim(), countryCode: form.countryCode.trim().toUpperCase() });
      meAgain(m);
      showToast({ text: '账户详情已更新' });
      navigation.goBack();
    } catch (e) {
      setError(message(e, '无法更新账户详情')); // toast.updateAccountDetailsFailed
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.screen}>
      <SettingsHeader title="账户详情" right={<HeaderAction label="保存" onPress={() => void save()} disabled={!me || busy} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {me ? (
          <>
            <Field label="邮箱" value={form.email} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address"
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} />
            <Field label="出生日期" value={form.birthday} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation"
              onChangeText={(v) => setForm((f) => ({ ...f, birthday: v }))} />
            <Field label="国家或地区" value={form.countryCode} placeholder="代码，例如 CN" autoCapitalize="characters" maxLength={2}
              onChangeText={(v) => setForm((f) => ({ ...f, countryCode: v }))} />
            <FormError text={error} />
            <SettingsGroup>
              <SettingsRow label="更新密码" statusLabel={me.hasPassword ? null : '未设置'} onPress={() => navigation.navigate(Routes.UPDATE_PASSWORD)} />
            </SettingsGroup>
          </>
        ) : error ? <FormError text={error} /> : <ActivityIndicator style={styles.loading} />}
      </KeyboardAwareScrollView>
    </View>
  );
}

export function UpdatePasswordScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [has, setHas] = useState<boolean | null>(null);
  const [form, setForm] = useState({ current: '', next: '', again: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void get<MeFull>('/api/me').then((m) => setHas(!!m.hasPassword), () => setHas(true)); }, []);
  const save = async () => {
    const { current, next, again } = form;
    // errors.currentPasswordRequired / newPasswordRequired / confirmPasswordRequired / passwordTooShort / passwordsDoNotMatch
    const err = has && !current ? '需要当前密码' : !next ? '需要新密码' : !again ? '需要确认密码' : next.length < 8 ? '密码必须至少为 8 个字符' : next !== again ? '密码不匹配，请重试' : '';
    if (err) { setError(err); return; }
    setBusy(true);
    try {
      await api('POST', '/api/me/password', { currentPassword: current, newPassword: next });
      showToast({ text: '密码已更新' });
      navigation.goBack();
    } catch (e) {
      setError(message(e, '无法更新密码'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.screen}>
      <SettingsHeader title="更新密码" right={<HeaderAction label="保存" onPress={() => void save()} disabled={has == null || busy} />} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {has === false ? <Text style={styles.note}>这个账号还没有密码：设一个之后，就能在别的设备上用用户名或邮箱加密码登录。</Text> : null}
        {has ? <Field label="当前密码" value={form.current} secureTextEntry autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, current: v }))} /> : null}
        <Field label="新密码" value={form.next} secureTextEntry autoCapitalize="none" placeholder="至少 8 个字符" onChangeText={(v) => setForm((f) => ({ ...f, next: v }))} />
        <Field label="确认新密码" value={form.again} secureTextEntry autoCapitalize="none" onChangeText={(v) => setForm((f) => ({ ...f, again: v }))} />
        <FormError text={error} />
      </KeyboardAwareScrollView>
    </View>
  );
}

type Filtering = {
  settings: Record<string, string>;
  model: string | null;
  library: { classified: number; explicit: number; suggestive: number; pending: number; unclassified: number };
  ai: { done: number; total: number };
};
const CATEGORIES: [string, string, string][] = [
  ['explicit', '露骨内容', '内容涉及裸体和性内容'], // settings.explicitContent / explicitContentDescriptionAdult
  ['suggestive', '暗示性内容', '暴露的着装和挑逗性的姿势'], // settings.suggestiveContent (the description reworded: the pack's is machine-translated)
];

export function ContentFilteringScreen() {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<Filtering | null>(null);
  useEffect(() => { void get<Filtering>('/api/settings/content-filtering').then(setF, (e) => showToast({ text: message(e, '读不到内容过滤') })); }, []);
  const set = async (flag: string, value: string) => {
    if (!f || f.settings[flag] === value) return;
    const before = f;
    setF({ ...f, settings: { ...f.settings, [flag]: value } });
    try {
      setF(await api<Filtering>('POST', '/api/settings/content-filtering', { [flag]: value }));
    } catch (e) {
      setF(before);
      showToast({ text: message(e, '无法更改内容过滤') });
    }
  };
  return (
    <View style={styles.screen}>
      <SettingsHeader title="内容过滤" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {f ? (
          <>
            {CATEGORIES.map(([flag, title, description]) => (
              <View key={flag} style={styles.category}>
                <Text style={styles.categoryTitle}>{title}</Text>
                <Text style={styles.categoryText}>{description}</Text>
                <View style={styles.segments}>
                  {TREATMENTS.map(([v, label]) => (
                    <Pressable key={v} style={[styles.segment, f.settings[flag] === v && styles.segmentOn]} onPress={() => void set(flag, v)}
                      accessibilityRole="radio" accessibilityState={{ selected: f.settings[flag] === v }}>
                      <Text style={[styles.segmentText, f.settings[flag] === v && styles.segmentTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Text style={styles.note}>
              {f.model
                ? `库里已分类 ${f.library.classified} 张：露骨 ${f.library.explicit}、暗示性 ${f.library.suggestive}。分类进度 ${f.ai.done}/${f.ai.total}。`
                  + (f.library.pending || f.library.unclassified ? `还有 ${f.library.pending} 张在等分类、${f.library.unclassified} 张没能分类：分类之前按上面两档里更严格的一档处理。` : '')
                : '敏感内容分类已关闭，所以没有图片会被标注。'}
            </Text>
            <Text style={styles.note}>“隐藏”只是不出现在列表、搜索和相似里，内容还在库里。</Text>
          </>
        ) : <ActivityIndicator style={styles.loading} />}
      </ScrollView>
    </View>
  );
}

type Blocked = { id: string; username: string; fullName?: string; avatarUrl?: string | null };

export function BlockedAccountsScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Blocked[] | null>(null);
  useEffect(() => { void get<{ items: Blocked[] }>('/api/me/blocked').then((r) => setList(r.items), () => setList([])); }, []);
  const unblock = async (p: Blocked) => {
    try {
      await api('DELETE', `/api/users/${encodeURIComponent(p.id)}/block`);
      setList((l) => l?.filter((x) => x.id !== p.id) ?? null);
      showToast({ text: `已解除屏蔽 ${p.fullName || p.username}` });
    } catch (e) {
      showToast({ text: message(e, '无法解除屏蔽') });
    }
  };
  return (
    <View style={styles.screen}>
      <SettingsHeader title="已屏蔽账号" />
      <FlatList
        data={list ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        renderItem={({ item: p }) => (
          <View style={styles.person}>
            <Avatar user={p} size={40} />
            <View style={styles.personText}>
              <Text style={styles.personName} numberOfLines={1}>{p.fullName || p.username}</Text>
              <Text style={styles.personMeta} numberOfLines={1}>@{p.username}</Text>
            </View>
            <Button text="解除屏蔽" variant="outline" size="small" fitContent onPress={() => void unblock(p)} />
          </View>
        )}
        ListEmptyComponent={list == null ? <ActivityIndicator color={theme.colors.tertiary} style={styles.loading} /> : <Text style={styles.empty}>没有已屏蔽的账号</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xs },
  loading: { marginTop: theme.spacing.xl },
  note: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.tertiary, marginTop: theme.spacing.md },
  empty: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center', marginTop: theme.spacing.xl },
  avatarBlock: { alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  avatarActions: { flexDirection: 'row', gap: theme.spacing.xs },
  category: { marginTop: theme.spacing.lg },
  categoryTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  categoryText: { ...theme.typography.regular, color: theme.colors.tertiary, marginTop: 2 },
  segments: { flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  segment: {
    flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.surfaceBorder,
  },
  segmentOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  segmentText: { ...theme.typography.regularPlus, color: theme.colors.primary },
  segmentTextOn: { color: theme.colors.background },
  person: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  personText: { flex: 1, minWidth: 0 },
  personName: { ...theme.typography.largePlus, color: theme.colors.primary },
  personMeta: { ...theme.typography.regular, color: theme.colors.tertiary },
}));
