// Cosmos' ReportSheet (components/elements/ReportSheet.js, useReportElement), reporting an element in three steps:
//   - reasons: 举报元素 (largePlus, centred, spacing.md under it), spacing.md round; a row per reason (spacing.xs over
//     and under, 4 in): its title (regular, 18 high, primary) over its description (caption, tertiary), 2 apart, and a
//     14 chevron; 标题不准确 / 冒犯 / 垃圾内容 / 暴力 / 裸露
//   - 标题不准确 asks what is wrong (报告标题, a field: regular, elevated, borderRadius.md, lg × md padding, at least
//     132 high, 这个标题有什么不正确的地方吗？); the others ask to confirm (ActionConfirmationSheet: the reason's
//     report.confirm title and description); 取消 (outline) and 举报 (primary) share the row, spacing.xs apart, md over
//   - sent (POST /api/reports { kind: element, reason, note }): SheetSuccess 收到报告 · 感谢您告知我们。 and 完成
// A collection or a person is reported straight away after one question (UserProfileMenus / MoreMenu: 举报 ·
// 提交内容均为匿名, the system's alert), then toast 收到报告 · 感谢您告知我们。
// The words are the web page's (6.106) where 2.33's pack reads machine-translated (报表元素, 进攻, 垃圾邮件, 报告).
// Near Cosmos: the nudity confirmation's link to the settings is plain text.
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRightIcon } from '../icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { create } from 'zustand';
import { api } from '../../lib/api';
import { showToast } from '../../stores/useToastStore';
import { Button } from '../Button';
import { SheetGrabber } from './SheetGrabber';

export const REPORT_SHEET = 'report';

const REASONS = [
  { id: 'INACCURATE_CAPTION', title: '标题不准确', description: '错误的、不正确的标签', confirmTitle: '举报标题？', confirmText: '我们将审核标题并根据需要采取行动' },
  { id: 'OFFENSIVE', title: '冒犯', description: '骚扰、诽谤、欺凌', confirmTitle: '举报冒犯？', confirmText: '不当内容将被删除' },
  { id: 'SPAM', title: '垃圾内容', description: '低质量或垃圾内容', confirmTitle: '举报为垃圾内容？', confirmText: '帮助我们保持高质量的内容' },
  { id: 'VIOLENCE', title: '暴力', description: '仇恨、露骨或威胁性内容', confirmTitle: '举报暴力？', confirmText: '暴力内容将被删除' },
  { id: 'NUDITY', title: '裸露', description: '露骨内容', confirmTitle: '举报不当？', confirmText: 'Cosmos 上允许出现暗示性和露骨的内容。要隐藏它们，请调整设置里的内容过滤。' },
] as const;
type Reason = (typeof REASONS)[number];

type State = { elementId: string | null; open: (elementId: string) => void };
export const useReportStore = create<State>((set) => ({
  elementId: null,
  open: (elementId) => {
    set({ elementId });
    void TrueSheet.present(REPORT_SHEET).catch(() => undefined);
  },
}));

// a collection or a person: one question, then the report
export function reportTarget(kind: 'cluster' | 'user', id: string) {
  Alert.alert('举报', '提交内容均为匿名', [
    { text: '取消', style: 'cancel' },
    {
      text: '举报', style: 'destructive',
      onPress: () => void api('POST', '/api/reports', { kind, targetId: id }).then(
        () => showToast({ text: '收到报告 · 感谢您告知我们。' }),
        () => showToast({ text: kind === 'cluster' ? '举报收藏夹失败' : '举报失败' }),
      ),
    },
  ]);
}

export function ReportSheet() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const elementId = useReportStore((s) => s.elementId);
  const [step, setStep] = useState<'reasons' | 'confirm' | 'caption' | 'success'>('reasons');
  const [reason, setReason] = useState<Reason | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => TrueSheet.dismiss(REPORT_SHEET).catch(() => undefined);

  const send = async () => {
    if (!elementId || !reason || busy) return;
    setBusy(true);
    try {
      await api('POST', '/api/reports', { kind: 'element', targetId: elementId, reason: reason.id, note: caption.trim() || undefined });
      setStep('success');
    } catch {
      showToast({ text: '举报失败' });
    } finally {
      setBusy(false);
    }
  };
  const buttons = (
    <View style={styles.buttons}>
      <Button text="取消" variant="outline" size="regular" onPress={() => void close()} style={styles.button} />
      <Button text="举报" size="regular" loading={busy} disabled={step === 'caption' && !caption.trim()} onPress={() => void send()} style={styles.button} />
    </View>
  );

  return (
    <TrueSheet
      name={REPORT_SHEET}
      detents={['auto']}
      cornerRadius={24}
      grabber={false}
      backgroundColor={theme.colors.sheetBackground}
      onDidDismiss={() => { setStep('reasons'); setReason(null); setCaption(''); useReportStore.setState({ elementId: null }); }}
    >
      <SheetGrabber />
      <View style={[styles.content, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        {step === 'reasons' ? (
          <>
            <Text style={styles.title}>举报元素</Text>
            <View style={styles.list}>
              {REASONS.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.reasonRow}
                  onPress={() => { setReason(r); setStep(r.id === 'INACCURATE_CAPTION' ? 'caption' : 'confirm'); }}
                  accessibilityRole="button"
                >
                  <View style={styles.reasonContent}>
                    <Text style={styles.reasonTitle}>{r.title}</Text>
                    <Text style={styles.reasonDescription}>{r.description}</Text>
                  </View>
                  <ChevronRightIcon color={theme.colors.tertiary} size={14} />
                </Pressable>
              ))}
            </View>
          </>
        ) : step === 'caption' ? (
          <>
            <Text style={styles.title}>报告标题</Text>
            <TextInput
              value={caption} onChangeText={setCaption} multiline autoFocus placeholder="这个标题有什么不正确的地方吗？"
              placeholderTextColor={theme.colors.tertiary} style={styles.input}
            />
            {buttons}
          </>
        ) : step === 'confirm' && reason ? (
          <>
            <Text style={styles.title}>{reason.confirmTitle}</Text>
            <Text style={styles.description}>{reason.confirmText}</Text>
            {buttons}
          </>
        ) : (
          <>
            <Text style={styles.title}>收到报告</Text>
            <Text style={styles.description}>感谢您告知我们。</Text>
            <Button text="完成" fullWidth onPress={() => void close()} style={styles.done} />
          </>
        )}
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: { padding: theme.spacing.md, paddingTop: 0 },
  title: { ...theme.typography.largePlus, color: theme.colors.primary, textAlign: 'center', marginBottom: theme.spacing.md },
  list: { paddingLeft: 4 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.xs, gap: theme.spacing.sm },
  reasonContent: { flex: 1, gap: 2 },
  reasonTitle: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.primary },
  reasonDescription: { ...theme.typography.caption, color: theme.colors.tertiary },
  input: {
    ...theme.typography.regular, lineHeight: 18, color: theme.colors.primary, backgroundColor: theme.colors.elevated, borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, minHeight: 132, textAlignVertical: 'top',
  },
  description: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.tertiary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.md },
  button: { flex: 1 },
  done: { marginTop: theme.spacing.md },
}));
