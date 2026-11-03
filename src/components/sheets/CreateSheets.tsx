// Cosmos' create sheets (SHEET_NAMES.CREATE / CREATE_URL / CREATE_NOTE), opened by the profile's 创建 and a
// collection's 添加 (openCreateSheet; sourceContext 'profile' or 'default').
//   - CreateSheet: 2.33 has config.createBentoEnabled on, so its content is CreateBentoSheetContent (sized to fit, not
//     full): three CreateBentoAction squares in a row — 照片 (CameraRollIcon) / 链接 (LinkIcon) / 笔记 (ALargeIcon):
//     flex, 90 high, rounded lg, sheetElevated, the 24 icon over the label (largePlus) 5 apart, pressed to 0.96 — and
//     under them the collection row (88 high, rounded lg, sheetElevated, lg in, 13 between, pressed to 0.98): a 48
//     MosaicPlaceholder (rounded sm, tertiary at 0.25, 2 wide dividers in sheetElevated), the title (largePlus) over
//     the subtitle (regular tertiary) 3 apart, a 24 PlusIcon (getCreateBentoCollectionCopy: on the profile
//     创建新收藏集 — 创建您的第一个收藏 while there is none — · 整理你的元素; in a collection 创建子集合 · 元素的嵌套文件夹).
//     The sheet: lg in, 6 from the grabber, spacing.sm between.
//   - CreateSheetHeader (the link and note sheets, full height): a 40 round close button (the background, a hairline
//     surfaceBorder, the strong shadow, CloseIcon 24), the title (largePlus) in the middle, a 40 spacer.
//   - CreateUrlSheet: 新网址, one field (body.xl, centred, rounded md, md in, xs over it and xxxl under it, the
//     placeholder cosmos.so, focused, no capitals or corrections), 添加网址 (large, the width), enabled for a web address
//     (VALID_WEBSITE_URL_REGEX). Made in the collection it was opened in, else on the profile.
//   - CreateNoteSheet: 新笔记, the rich editor (EnrichedTextInput, body.lg, 30 % of the window high, 梦想远大), the
//     toolbar (editorOptions: 标题 1 / 标题 2 / 粗体 / 斜体 / 列表 / 下划线; a 46 high round bar on the background with a
//     1 px surfaceBorder and the default shadow, md over the button, 1 px dividers, the active one on primary, 16
//     icons, a blocked one at half strength), 添加备注 (large, the width, enabled once something is written). Saved as
//     Markdown (convertSupportedHtmlToMarkdown). Outside a collection the save sheet opens on it (CreateNoteSheet.move).
// Words: 照片 / 新网址 / 添加网址 / 新笔记 / 梦想远大 / 添加备注 / 创建… are the Chinese pack's; 链接 is the web page's
// (the pack's 关联 is machine-made).
// Near Cosmos: the link is fetched by the computer as a job, so the save sheet does not open on it (Cosmos opens it on
// the new element: CreateUrlSheet.move) — a toast says it is being saved; the profile's first collection shows the
// still mosaic (Cosmos animates ProfileCollectionAnimatedMosaic); the sheets close one by one rather than as a stack.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import * as Haptics from 'expo-haptics';
import { triggerImpactFeedback } from '../../lib/appearance';
import { useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { EnrichedTextInput, type EnrichedTextInputInstance, type OnChangeStateEvent } from 'react-native-enriched';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { pickAndUploadMedia } from '../../lib/createMedia';
import type { Element } from '../../lib/elements';
import { htmlToMarkdown } from '../../lib/markdown';
import { useMoveSheetStore } from '../../stores/useMoveSheetStore';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import { ALargeIcon, BoldIcon, CameraRollIcon, CloseIcon, Heading1Icon, Heading2Icon, ItalicIcon, LinkIcon, ListIcon, PlusIcon, UnderlineIcon } from '../icons';
import { useCreateClusterStore } from './CreateClusterSheet';
import { SheetGrabber } from './SheetGrabber';

export const CREATE_SHEET = 'create';
export const CREATE_URL_SHEET = 'create-url';
export const CREATE_NOTE_SHEET = 'create-note';
const VALID_WEBSITE_URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(:\d+)?(\/\S*)?$/i;
const NOTE_HEIGHT_RATIO = 0.3;
const DIVIDER = 2;

// where it was opened: the profile, or a collection (made there; its 子集合 when it may have one)
type CreateContext = {
  isOnProfile: boolean;
  clusterId: string | null;
  subParent: { id: string; name: string } | null;
  firstCollection: boolean;
  onChanged: () => void; // something was made here
};
type CreateState = { context: CreateContext | null; open: (context: CreateContext) => void };
export const useCreateSheetStore = create<CreateState>((set) => ({
  context: null,
  open: (context) => {
    set({ context });
    void TrueSheet.present(CREATE_SHEET).catch(() => undefined);
  },
}));

const dismiss = (name: string) => TrueSheet.dismiss(name).catch(() => undefined);
async function openOver(name: string) {
  await dismiss(CREATE_SHEET);
  void TrueSheet.present(name).catch(() => undefined);
}

// CustomPressable: down to targetScale and back in 120 ms, a light haptic
function ScalePressable({ targetScale, style, outerStyle, onPress, label, children }: { targetScale: number; style: object; outerStyle?: object; onPress: () => void; label: string; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      style={outerStyle}
      onPressIn={() => { triggerImpactFeedback(Haptics.ImpactFeedbackStyle.Light); scale.set(withTiming(targetScale, { duration: 120 })); }}
      onPressOut={() => scale.set(withTiming(1, { duration: 120 }))}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[style, pressed]}>{children}</Animated.View>
    </Pressable>
  );
}

function MosaicPlaceholder({ size, dividerColor }: { size: number; dividerColor: string }) {
  return (
    <View style={[styles.mosaic, { width: size, height: size }]}>
      <View style={styles.mosaicFill} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: (size - DIVIDER) / 2, width: DIVIDER, backgroundColor: dividerColor }} />
      <View style={{ position: 'absolute', right: 0, left: size / 2 + 1, top: (size - DIVIDER) / 2, height: DIVIDER, backgroundColor: dividerColor }} />
    </View>
  );
}

export function CreateSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const context = useCreateSheetStore((s) => s.context);
  const onProfile = context?.isOnProfile ?? true;
  const title = onProfile ? (context?.firstCollection ? '创建您的第一个收藏' : '创建新收藏集') : '创建子集合';
  const subtitle = onProfile ? '整理你的元素' : '元素的嵌套文件夹';
  // Cosmos' isInSubclusterView: not inside a sub-collection (nor here for whoever cannot nest one in this collection)
  const canMakeCollection = onProfile || !!context?.subParent;
  const photos = async () => {
    const c = context;
    if (c) await pickAndUploadMedia({ clusterId: c.clusterId, isOnProfile: c.isOnProfile }, () => dismiss(CREATE_SHEET));
  };
  const collection = async () => {
    const c = context;
    await dismiss(CREATE_SHEET);
    if (c) useCreateClusterStore.getState().open(() => c.onChanged(), c.isOnProfile ? null : c.subParent);
  };
  return (
    <TrueSheet name={CREATE_SHEET} detents={['auto'] as never} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}>
      <SheetGrabber />
      <View style={[styles.container, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <View style={styles.actionsRow}>
          <ScalePressable targetScale={0.96} style={styles.action} outerStyle={styles.actionOuter} onPress={() => void photos()} label="照片">
            <View style={styles.actionContent}><CameraRollIcon color={theme.colors.primary} size={24} /><Text style={styles.actionLabel} numberOfLines={1}>照片</Text></View>
          </ScalePressable>
          <ScalePressable targetScale={0.96} style={styles.action} outerStyle={styles.actionOuter} onPress={() => void openOver(CREATE_URL_SHEET)} label="链接">
            <View style={styles.actionContent}><LinkIcon color={theme.colors.primary} size={24} /><Text style={styles.actionLabel} numberOfLines={1}>链接</Text></View>
          </ScalePressable>
          <ScalePressable targetScale={0.96} style={styles.action} outerStyle={styles.actionOuter} onPress={() => void openOver(CREATE_NOTE_SHEET)} label="笔记">
            <View style={styles.actionContent}><ALargeIcon color={theme.colors.primary} size={24} /><Text style={styles.actionLabel} numberOfLines={1}>笔记</Text></View>
          </ScalePressable>
        </View>
        {canMakeCollection ? (
          <ScalePressable targetScale={0.98} style={styles.collectionRow} onPress={() => void collection()} label={title}>
            <MosaicPlaceholder size={48} dividerColor={theme.colors.sheetElevated} />
            <View style={styles.collectionText}>
              <Text style={styles.collectionTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.collectionSubtitle} numberOfLines={1}>{subtitle}</Text>
            </View>
            <PlusIcon color={theme.colors.primary} size={24} />
          </ScalePressable>
        ) : null}
      </View>
    </TrueSheet>
  );
}

function CreateSheetHeader({ title, onClosePress }: { title: string; onClosePress: () => void }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.headerContainer}>
      <Pressable style={styles.headerIconContainer} onPress={onClosePress} accessibilityRole="button" accessibilityLabel="关闭" hitSlop={4}>
        <CloseIcon color={theme.colors.primary} size={24} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// a link is an import on the computer that has no element yet when /api/save answers: the place it was added to reads
// itself again when the job is over (every 1.5 s, for a minute at most)
async function whenImported(jobId: string, onChanged: () => void) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const list = await api<{ jobs: { id: string; status: string }[] }>('GET', '/api/jobs').catch(() => null);
    const job = list?.jobs.find((j) => j.id === jobId);
    if (!job || (job.status !== 'NotStarted' && job.status !== 'Started')) { onChanged(); return; }
  }
}

async function made(kind: 'url' | 'note', r: { element?: Element; job?: { id: string } } | null) {
  const c = useCreateSheetStore.getState().context;
  c?.onChanged();
  if (kind === 'url' && r?.job && c) void whenImported(r.job.id, c.onChanged);
  if (kind === 'note' && r?.element && !c?.clusterId) useMoveSheetStore.getState().open(r.element); // CreateNoteSheet.move
  if (kind === 'url') showToast({ text: c?.clusterId ? '正在保存…' : '正在保存至个人资料…' });
}

export function CreateUrlSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = VALID_WEBSITE_URL_REGEX.test(url.trim());
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const clusterId = useCreateSheetStore.getState().context?.clusterId ?? undefined;
      const r = await api<{ job?: { id: string } }>('POST', '/api/save', { url: url.trim(), clusterId });
      Keyboard.dismiss();
      await dismiss(CREATE_URL_SHEET);
      await made('url', r);
    } catch {
      showToast({ text: '创建元素失败' }); // toast.createElementFailed
    } finally {
      setBusy(false);
    }
  };
  return (
    <TrueSheet name={CREATE_URL_SHEET} detents={[1] as never} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground} onDidDismiss={() => setUrl('')}>
      <SheetGrabber />
      <View style={[styles.urlContainer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <CreateSheetHeader title="新网址" onClosePress={() => void dismiss(CREATE_URL_SHEET)} />
        <TextInput
          value={url} onChangeText={setUrl} placeholder="cosmos.so" placeholderTextColor={theme.colors.tertiary} autoFocus
          autoCapitalize="none" autoComplete="off" autoCorrect={false} keyboardType="url" cursorColor={theme.colors.primary}
          selectionColor={theme.colors.surfaceBorder} style={styles.nameInput} textAlignVertical="center" onSubmitEditing={submit}
        />
        <Button text="添加网址" fullWidth disabled={!valid} loading={busy} onPress={submit} />
      </View>
    </TrueSheet>
  );
}

// editorOptions' icons
const EDITOR_ICONS = { heading1: Heading1Icon, heading2: Heading2Icon, bold: BoldIcon, italic: ItalicIcon, 'unordered-list': ListIcon, underline: UnderlineIcon };
const EDITOR_OPTIONS: { action: keyof typeof EDITOR_ICONS; label: string; state: keyof OnChangeStateEvent; run: (e: EnrichedTextInputInstance) => void }[] = [
  { action: 'heading1', label: '标题 1', state: 'h1', run: (e) => e.toggleH1() },
  { action: 'heading2', label: '标题 2', state: 'h2', run: (e) => e.toggleH2() },
  { action: 'bold', label: '粗体', state: 'bold', run: (e) => e.toggleBold() },
  { action: 'italic', label: '斜体', state: 'italic', run: (e) => e.toggleItalic() },
  { action: 'unordered-list', label: '列表', state: 'unorderedList' as keyof OnChangeStateEvent, run: (e) => e.toggleUnorderedList() },
  { action: 'underline', label: '下划线', state: 'underline', run: (e) => e.toggleUnderline() },
];

export function CreateNoteSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const editor = useRef<EnrichedTextInputInstance>(null);
  const [html, setHtml] = useState('');
  const [state, setState] = useState<OnChangeStateEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0); // a fresh editor each time
  const markdown = htmlToMarkdown(html);
  const submit = async () => {
    if (!markdown || busy) return;
    setBusy(true);
    try {
      const clusterId = useCreateSheetStore.getState().context?.clusterId ?? undefined;
      const r = await api<{ element?: Element }>('POST', '/api/save', { text: markdown, clusterId });
      Keyboard.dismiss();
      await dismiss(CREATE_NOTE_SHEET);
      await made('note', r);
    } catch {
      showToast({ text: '创建元素失败' });
    } finally {
      setBusy(false);
    }
  };
  const editorHeight = Math.round(height * NOTE_HEIGHT_RATIO);
  return (
    <TrueSheet
      name={CREATE_NOTE_SHEET} detents={[1] as never} cornerRadius={24} grabber={false} backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => { setHtml(''); setState(null); setKey((k) => k + 1); }}
    >
      <SheetGrabber />
      <View style={[styles.noteContainer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <CreateSheetHeader title="新笔记" onClosePress={() => void dismiss(CREATE_NOTE_SHEET)} />
        <EnrichedTextInput
          key={key}
          ref={editor}
          autoFocus
          placeholder="梦想远大"
          placeholderTextColor={theme.colors.tertiary}
          cursorColor={theme.colors.primary}
          selectionColor={theme.colors.surfaceBorder}
          style={{ ...styles.noteInput, minHeight: editorHeight, maxHeight: editorHeight }}
          onChangeHtml={(e) => setHtml(e.nativeEvent.value)}
          onChangeState={(e) => setState(e.nativeEvent)}
        />
        <View style={styles.editorOptionsContainer}>
          {EDITOR_OPTIONS.map((o, i) => {
            const s = state?.[o.state] as { isActive: boolean; isBlocking: boolean } | undefined;
            const active = !!s?.isActive;
            const EditorIcon = EDITOR_ICONS[o.action];
            return (
              <View key={o.action} style={styles.optionCell}>
                {i > 0 ? <View style={styles.separator} /> : null}
                <Pressable
                  disabled={!!s?.isBlocking}
                  style={[styles.editorOptionIconContainer, active && styles.editorOptionIconContainerActive, i === 0 && styles.first, i === EDITOR_OPTIONS.length - 1 && styles.last]}
                  onPress={() => { if (editor.current) o.run(editor.current); }}
                  accessibilityRole="button" accessibilityLabel={o.label} accessibilityState={{ selected: active }}
                >
                  <EditorIcon color={active ? theme.colors.inverted : theme.colors.primary} size={16} style={{ opacity: s?.isBlocking ? 0.5 : 1 }} />
                </Pressable>
              </View>
            );
          })}
        </View>
        <Button text="添加备注" fullWidth disabled={!markdown} loading={busy} onPress={submit} />
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { paddingHorizontal: theme.spacing.lg, paddingTop: 6, gap: theme.spacing.sm },
  actionsRow: { flexDirection: 'row', gap: theme.spacing.sm },
  actionOuter: { flex: 1 },
  action: { height: 90, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.sheetElevated, alignItems: 'center', justifyContent: 'center' },
  actionContent: { alignItems: 'center', gap: 5 },
  actionLabel: { ...theme.typography.largePlus, color: theme.colors.primary },
  collectionRow: {
    height: 88, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.sheetElevated, flexDirection: 'row', alignItems: 'center',
    gap: 13, paddingHorizontal: theme.spacing.lg,
  },
  mosaic: { borderRadius: theme.borderRadius.sm, overflow: 'hidden' },
  mosaicFill: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.tertiary, opacity: 0.25 },
  collectionText: { flex: 1, minWidth: 0, gap: 3 },
  collectionTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  collectionSubtitle: { ...theme.typography.regular, color: theme.colors.tertiary },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIconContainer: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, backgroundColor: theme.colors.background, boxShadow: theme.shadows.strong,
  },
  headerSpacer: { width: 40 },
  headerTitle: { ...theme.typography.largePlus, color: theme.colors.primary },
  urlContainer: { padding: theme.spacing.md, paddingBottom: 0 },
  nameInput: {
    ...theme.typography.body.xl, paddingHorizontal: theme.spacing.md, borderRadius: theme.borderRadius.md, textAlign: 'center',
    marginTop: theme.spacing.xs, marginBottom: theme.spacing.xxxl, color: theme.colors.primary,
  },
  noteContainer: { padding: theme.spacing.md, backgroundColor: theme.colors.sheetBackground, gap: theme.spacing.md },
  noteInput: { ...theme.typography.body.lg, borderRadius: theme.borderRadius.md, color: theme.colors.primary },
  editorOptionsContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.full, borderWidth: 1,
    borderColor: theme.colors.surfaceBorder, boxShadow: theme.shadows.default, height: 46, overflow: 'hidden',
  },
  optionCell: { flex: 1, height: '100%', flexDirection: 'row' },
  editorOptionIconContainer: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'center' },
  editorOptionIconContainerActive: { backgroundColor: theme.colors.primary },
  first: {},
  last: {},
  separator: { width: 1, height: '100%', backgroundColor: theme.colors.surfaceBorder },
}));
