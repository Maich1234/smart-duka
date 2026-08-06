import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';

/**
 * Turns the model's markdown-lite prose (***bold italic***, **bold**,
 * *italic*, `code`, "- " / "1. " lists) into real RN structure instead of
 * showing raw markdown syntax. Deliberately narrow — the chat system prompt
 * caps answers at 150 words of plain business commentary, so this covers
 * everything Gemini actually emits. Not a general markdown renderer; no need
 * for a parser dependency for this.
 */
export default function formatChatText(text: string): React.ReactNode {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!list) return;
    const { ordered, items } = list;
    blocks.push(
      <View key={key} style={s.list}>
        {items.map((item, i) => (
          <View key={i} style={s.listRow}>
            <Text style={s.text}>{ordered ? `${i + 1}.` : '•'}</Text>
            <Text style={[s.text, s.listItemText]}>{renderInline(item, `${key}-${i}`)}</Text>
          </View>
        ))}
      </View>
    );
    list = null;
  };

  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*+]\s+(.*)/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)/);
    if (bullet) {
      if (!list || list.ordered) {
        flushList(`list-${idx}`);
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (ordered) {
      if (!list || !list.ordered) {
        flushList(`list-${idx}`);
        list = { ordered: true, items: [] };
      }
      list.items.push(ordered[1]);
    } else {
      flushList(`p-${idx}`);
      blocks.push(
        <Text key={`p-${idx}`} style={[s.text, blocks.length > 0 && s.paragraphSpacing]}>
          {renderInline(line, `p-${idx}`)}
        </Text>
      );
    }
  });
  flushList('list-end');

  return <>{blocks}</>;
}

// Ordered longest-marker-first so e.g. ***x*** is consumed whole rather than
// leaving stray asterisks once the shorter ** / * alternatives partially match.
// Underscores are deliberately not treated as emphasis: shop/product names can
// contain them (e.g. "corner_store"), and italicizing a fragment of one would
// trade a visible-asterisk bug for a worse, quieter mangled-text bug.
const EMPHASIS = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderInline(line: string, keyPrefix: string): React.ReactNode {
  return line
    .split(EMPHASIS)
    .filter(Boolean)
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.startsWith('***') && part.endsWith('***')) {
        return (
          <Text key={key} style={[s.bold, s.italic]}>
            {part.slice(3, -3)}
          </Text>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={key} style={s.bold}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <Text key={key} style={s.italic}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Text key={key} style={s.code}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return <Text key={key}>{part}</Text>;
    });
}

const s = StyleSheet.create({
  text: { fontSize: Typography.size.small, lineHeight: 20, fontFamily: Typography.fontFamily, color: Colors.textPrimary },
  paragraphSpacing: { marginTop: Spacing.xs },
  bold: { fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: Colors.border, borderRadius: 3, paddingHorizontal: 3 },
  list: { marginTop: Spacing.xs, gap: 2 },
  listRow: { flexDirection: 'row', gap: 6 },
  listItemText: { flex: 1 },
});
