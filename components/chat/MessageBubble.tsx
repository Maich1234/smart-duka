import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { ToolsUsedFootnote } from './ToolsUsedFootnote';

interface MessageBubbleProps {
  role: 'user' | 'model';
  text: string;
  toolsUsed?: string[];
}

export function MessageBubble({ role, text, toolsUsed }: MessageBubbleProps) {
  const isUser = role === 'user';
  return (
    <View style={[s.row, isUser ? s.rowUser : s.rowModel]}>
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleModel]}>
        <Text style={[s.text, isUser ? s.textUser : s.textModel]}>{text}</Text>
      </View>
      {!isUser && toolsUsed && toolsUsed.length > 0 ? <ToolsUsedFootnote toolsUsed={toolsUsed} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { marginBottom: Spacing.sm, maxWidth: '85%' },
  rowUser: { alignSelf: 'flex-end' },
  rowModel: { alignSelf: 'flex-start' },
  bubble: { borderRadius: BorderRadius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleModel: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  text: { fontSize: Typography.size.small, lineHeight: 20, fontFamily: Typography.fontFamily },
  textUser: { color: Colors.white },
  textModel: { color: Colors.textPrimary },
});
