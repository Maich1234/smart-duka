import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { HelpLink } from '@/components/help/HelpLink';
import { getHelpTopic } from '@/constants/helpTopics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function HelpTopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const topic = getHelpTopic(slug);

  if (!topic) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: 'Help' }} />
        <ErrorState
          title="Topic not found"
          subtitle="This help topic doesn't exist."
          onRetry={() => router.replace('/(help)')}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: topic.category }} />

      <Text style={styles.title}>{topic.title}</Text>
      <Text style={styles.summary}>{topic.summary}</Text>

      {topic.sections.map((section, index) => (
        <View key={index} style={styles.section}>
          {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
          {section.paragraphs?.map((p, i) => (
            <Text key={i} style={styles.paragraph}>{p}</Text>
          ))}
          {section.bullets ? (
            <View style={styles.bulletList}>
              {section.bullets.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>{'•'}</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {section.example ? (
            <View style={styles.exampleBox}>
              <Text style={styles.exampleLabel}>Example</Text>
              <Text style={styles.exampleText}>{section.example}</Text>
            </View>
          ) : null}
        </View>
      ))}

      {topic.relatedSlugs && topic.relatedSlugs.length > 0 ? (
        <View style={styles.related}>
          <Text style={styles.relatedTitle}>Related topics</Text>
          {topic.relatedSlugs.map((relatedSlug) => {
            const related = getHelpTopic(relatedSlug);
            if (!related) return null;
            return <HelpLink key={relatedSlug} slug={relatedSlug} label={related.title} style={styles.relatedLink} />;
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  errorContainer: { flex: 1, justifyContent: 'center', backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  title: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  summary: { fontSize: Typography.size.small, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: Typography.lineHeight.small },
  section: { marginBottom: Spacing.lg },
  heading: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  paragraph: { fontSize: Typography.size.small, color: Colors.textPrimary, lineHeight: Typography.lineHeight.small, marginBottom: Spacing.xs },
  bulletList: { marginTop: Spacing.xs },
  bulletRow: { flexDirection: 'row', marginBottom: Spacing.xs, paddingRight: Spacing.sm },
  bulletDot: { fontSize: Typography.size.small, color: Colors.primary, marginRight: Spacing.sm },
  bulletText: { flex: 1, fontSize: Typography.size.small, color: Colors.textPrimary, lineHeight: Typography.lineHeight.small },
  exampleBox: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    borderRadius: 6,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  exampleLabel: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleText: { fontSize: Typography.size.small, color: Colors.textPrimary, lineHeight: Typography.lineHeight.small },
  related: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider },
  relatedTitle: { fontSize: Typography.size.caption, fontFamily: Typography.fontFamilySemiBold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  relatedLink: { marginBottom: Spacing.xs },
});
