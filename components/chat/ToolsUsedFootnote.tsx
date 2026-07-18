import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

// Renders which real data a model answer was grounded in — the one UI
// element that makes "grounded, not hallucinated" visible to the owner.
const TOOL_LABELS: Record<string, string> = {
  get_business_snapshot: 'business snapshot',
  get_daily_summary: 'daily summary',
  get_sales_trend: 'sales trend',
  get_peak_hours: 'peak hours',
  get_depletion_analytics: 'inventory data',
  detect_sales_anomaly: 'anomaly check',
  get_staff_performance: 'staff performance',
  get_expense_summary: 'expenses',
};

export function ToolsUsedFootnote({ toolsUsed }: { toolsUsed: string[] }) {
  const labels = toolsUsed.map((t) => TOOL_LABELS[t] ?? t).join(', ');
  return <Text style={s.text}>Based on: {labels}</Text>;
}

const s = StyleSheet.create({
  text: { fontSize: 11, fontFamily: Typography.fontFamily, color: Colors.textTertiary, marginTop: 4, marginLeft: 4 },
});
