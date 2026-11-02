// The AI description under the media, as Cosmos' ElementDescription draws it (getElementGeneratedCaptionText): centred
// in 75 % of the width, spacing.md from the media; the words textElementFeedBody in the tertiary colour, its
// <n>key terms</n> as chips in the primary colour (the background colour, a 0.5 surfaceBorder outline,
// borderRadius.xs, the default shadow, 2 apart, 6 / 1 inside) that search for themselves when pressed (onTagPress: global search, origin
// caption). The tokens
// wrap as whole pieces, rows spacing.xxs apart; Chinese splits into its characters with a closing mark kept on its
// character (cosmos-lite's choice, the user's: Cosmos splits on spaces only).
// Near Cosmos: it shows two rows (useCollapsedCaptionTokens maxLines 2) and 更多 under them to open the rest, where
// Cosmos puts " ... 更多" after the last token that fits.
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { openGlobalSearch } from '../../lib/globalSearch';
import { useSearchStore } from '../../stores/useSearchStore';

// onTagPress: the keyword searched for in the global search, as a search from the description (origin caption)
function searchKeyword(term: string) {
  useSearchStore.getState().submit(term, 'caption');
  openGlobalSearch();
}

const CJK = '⺀-鿿豈-﫿　-〿＀-￯';
const PIECE = new RegExp(`\\s+|[${CJK}]|[^\\s${CJK}]+`, 'gu');
const CLOSING_MARK = /^[，。、；：？！）」』》〉】”’…·,.;:?!)\]]+$/u;
const ROW_HEIGHT = 24;
const ROW_GAP = 4;

type Token = { text: string; isTag?: boolean; trail?: string };

function captionTokens(caption: string): Token[] {
  const tokens: Token[] = [];
  const words = (text: string) => {
    for (const w of text.match(PIECE) ?? []) {
      const prev = tokens[tokens.length - 1];
      if (!CLOSING_MARK.test(w) || !prev) tokens.push({ text: w });
      else if (prev.isTag) prev.trail = (prev.trail ?? '') + w;
      else if (prev.text.trim()) prev.text += w;
      else tokens.push({ text: w });
    }
  };
  let last = 0;
  for (const m of caption.matchAll(/<n>(.*?)<\/n>/g)) {
    words(caption.slice(last, m.index));
    tokens.push({ text: m[1], isTag: true });
    last = (m.index ?? 0) + m[0].length;
  }
  words(caption.slice(last));
  return tokens;
}

export function ElementDescription({ caption }: { caption: string }) {
  const tokens = useMemo(() => captionTokens(caption), [caption]);
  const [height, setHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const collapsedHeight = ROW_HEIGHT * 2 + ROW_GAP;
  const long = height > collapsedHeight + 1;
  return (
    <View style={styles.container}>
      <View style={[styles.clip, !open && long && { maxHeight: collapsedHeight }]}>
        <View style={styles.text} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          {tokens.map((t, i) => (t.isTag ? (
            <View key={i} style={styles.group}>
              <Pressable style={styles.chip} onPress={() => searchKeyword(t.text)} accessibilityRole="button" hitSlop={4}>
                <Text style={styles.chipText}>{t.text}</Text>
              </Pressable>
              {t.trail ? <Text style={styles.word}>{t.trail}</Text> : null}
            </View>
          ) : <Text key={i} style={styles.word}>{t.text}</Text>))}
        </View>
      </View>
      {long && !open ? (
        <Pressable onPress={() => setOpen(true)} hitSlop={8}><Text style={styles.more}>更多</Text></Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { alignSelf: 'center', width: '75%', paddingTop: theme.spacing.md, alignItems: 'center' },
  clip: { overflow: 'hidden', width: '100%' },
  text: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', rowGap: ROW_GAP },
  word: { ...theme.typography.textElementFeedBody, lineHeight: 20, color: theme.colors.tertiary },
  group: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    marginHorizontal: 2, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.xs, backgroundColor: theme.colors.background, boxShadow: theme.shadows.default,
  },
  chipText: { ...theme.typography.textElementFeedBody, lineHeight: 20, color: theme.colors.primary },
  more: { ...theme.typography.textElementFeedBody, color: theme.colors.primary, marginTop: ROW_GAP },
}));
