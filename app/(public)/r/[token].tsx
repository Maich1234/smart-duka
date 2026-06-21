import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getPublicReceipt, submitPublicRating } from '@/services/ratings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { APP_NAME, APP_SCHEME } from '@/constants/config';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

const STAR_VALUES = [1, 2, 3, 4, 5];

export default function ReceiptVerificationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicReceipt', token],
    queryFn: () => getPublicReceipt(token),
    enabled: !!token,
    retry: false,
  });

  const ratingMutation = useMutation({
    mutationFn: () => submitPublicRating(token, { stars, comment: comment.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicReceipt', token] });
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data?.success) {
    return (
      <View style={styles.errorContainer}>
        <ErrorState title="Receipt not found" subtitle="This receipt code is invalid or could not be found." />
      </View>
    );
  }

  const receipt = data.data;
  const hasRated = receipt.alreadyRated || ratingMutation.isSuccess;
  const finalStars = receipt.rating?.stars ?? stars;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.badge}>
        <Ionicons name="shield-checkmark" size={40} color={Colors.success} />
      </View>
      <Text style={styles.verified}>Verified Authentic Receipt</Text>
      <Text style={styles.poweredBy}>{APP_NAME} POS</Text>

      {Platform.OS === 'web' && (
        <TouchableOpacity
          style={styles.openAppButton}
          onPress={() => {
            Linking.openURL(`${APP_SCHEME}://r/${token}`).catch(() => {
              // App isn't installed — the user just stays on this web page.
            });
          }}
        >
          <Ionicons name="phone-portrait-outline" size={16} color={Colors.primary} />
          <Text style={styles.openAppText}>Open in Smart Duka App</Text>
        </TouchableOpacity>
      )}

      <Card style={styles.receiptCard}>
        <Text style={styles.shopName}>{receipt.shopName}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Invoice</Text>
          <Text style={styles.value}>{receipt.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{formatDateTime(receipt.createdAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Items</Text>
          <Text style={styles.value}>{receipt.itemCount}</Text>
        </View>
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(receipt.totalAmount, receipt.currency)}</Text>
        </View>
      </Card>

      <Card style={styles.ratingCard}>
        {hasRated ? (
          <View style={styles.thankYou}>
            <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
            <Text style={styles.thankYouTitle}>Thank you for your feedback!</Text>
            <View style={styles.starRow}>
              {STAR_VALUES.map((s) => (
                <Ionicons
                  key={s}
                  name={s <= finalStars ? 'star' : 'star-outline'}
                  size={28}
                  color={Colors.warning}
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.ratePrompt}>How was your service today?</Text>
            <View style={styles.starRow}>
              {STAR_VALUES.map((s) => (
                <TouchableOpacity key={s} onPress={() => setStars(s)} hitSlop={8}>
                  <Ionicons
                    name={s <= stars ? 'star' : 'star-outline'}
                    size={36}
                    color={Colors.warning}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Input
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
            />
            <Button
              title="Submit Rating"
              onPress={() => ratingMutation.mutate()}
              disabled={stars === 0}
              loading={ratingMutation.isPending}
            />
            {ratingMutation.isError && (
              <Text style={styles.errorText}>Could not submit your rating. Please try again.</Text>
            )}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.background },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.background },
  badge: { marginTop: Spacing.xl, marginBottom: Spacing.sm },
  verified: { fontSize: Typography.size.h2, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, textAlign: 'center' },
  poweredBy: { fontSize: Typography.size.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
  openAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  openAppText: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.primary },
  errorText: { fontSize: Typography.size.body, color: Colors.danger, textAlign: 'center', marginTop: Spacing.md },

  receiptCard: { width: '100%', maxWidth: 420, padding: Spacing.lg, marginBottom: Spacing.md },
  shopName: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: Typography.size.small, color: Colors.textSecondary },
  value: { fontSize: Typography.size.small, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.divider, marginTop: Spacing.xs, paddingTop: Spacing.sm },
  totalLabel: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilyBold, color: Colors.textPrimary },
  totalValue: { fontSize: Typography.size.h3, fontFamily: Typography.fontFamilyBold, color: Colors.success },

  ratingCard: { width: '100%', maxWidth: 420, padding: Spacing.lg, alignItems: 'center' },
  ratePrompt: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginBottom: Spacing.md },
  starRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  thankYou: { alignItems: 'center', paddingVertical: Spacing.md },
  thankYouTitle: { fontSize: Typography.size.body, fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary, marginTop: Spacing.sm, marginBottom: Spacing.sm },
});
