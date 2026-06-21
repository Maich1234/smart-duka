import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { HELP_CATEGORIES, HELP_TOPICS, searchHelpTopics, type HelpTopic } from '@/constants/helpTopics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

function TopicRow({ topic }: { topic: HelpTopic }) {
  return (
    <Card style={styles.topicCard} onPress={() => router.push(`/(help)/${topic.slug}`)}>
      <View style={styles.topicRow}>
        <View style={styles.topicText}>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          <Text style={styles.topicSummary} numberOfLines={2}>{topic.summary}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
      </View>
    </Card>
  );
}

export default function HelpCenterIndex() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchHelpTopics(query), [query]);
  const isSearching = query.trim().length > 0;

  const grouped = useMemo(() => {
    return HELP_CATEGORIES.map((category) => ({
      category,
      topics: HELP_TOPICS.filter((t) => t.category === category),
    })).filter((g) => g.topics.length > 0);
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Plain-language guides for the parts of Smart Duka that can be confusing at first. Search below, or browse by topic.
      </Text>

      <SearchBar value={query} onChangeText={setQuery} placeholder="Search help topics..." />

      <View style={styles.content}>
        {isSearching ? (
          results.length === 0 ? (
            <EmptyState title="No matching topics" subtitle="Try a different word, like 'stock' or 'bundle'." />
          ) : (
            results.map((topic) => <TopicRow key={topic.slug} topic={topic} />)
          )
        ) : (
          grouped.map(({ category, topics }) => (
            <View key={category} style={styles.section}>
              <Text style={styles.sectionTitle}>{category}</Text>
              {topics.map((topic) => (
                <TopicRow key={topic.slug} topic={topic} />
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  intro: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    lineHeight: Typography.lineHeight.small,
  },
  content: { padding: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  topicCard: { marginBottom: Spacing.sm },
  topicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topicText: { flex: 1, marginRight: Spacing.sm },
  topicTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: 2 },
  topicSummary: { fontSize: Typography.size.caption, color: Colors.textSecondary },
});
