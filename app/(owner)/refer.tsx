import React from 'react';
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useAlert } from '@/context/AlertContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { QueryError } from '@/components/ui/QueryError';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { getShopReferrals } from '@/services/shop';
import { WEB_URL } from '@/constants/config';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/**
 * Refer & Earn — informational only, same spirit as subscription.tsx: no
 * link or button here points at a payment/checkout page for the current
 * user. The shared link goes to /register, a signup page for someone else
 * entirely; the banked discount is read-only status, applied automatically
 * server-side on this shop's own next payment, never something the current
 * user "redeems" through the app.
 */
export default function ReferScreen() {
  const tabBarHeight = useTabBarHeight();
  const { toast } = useAlert();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shop', 'referrals'],
    queryFn: getShopReferrals,
  });

  const copyCode = async () => {
    if (!data?.code) return;
    await Clipboard.setStringAsync(data.code);
    toast({ type: 'success', message: 'Code copied' });
  };

  const shareLink = async () => {
    if (!data?.shareUrl) return;
    try {
      await Share.share({
        message: `Join me on Dukana — sign up with my code ${data.code} at ${data.shareUrl}`,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return <QueryError onRetry={refetch} message="Could not load your referral details. Check your connection and try again." />;
  }

  if (!data.enabled) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="gift-outline" size={40} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>The referral program isn&apos;t live yet — check back soon.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]}
    >
      <Animated.View entering={FadeInUp.duration(360)}>
        <Text style={styles.intro}>
          Invite other shop owners to Dukana. When someone you invite becomes a paying customer, you get{' '}
          {data.perReferralPercent}% off your next subscription payment.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(360).delay(60)}>
        <Card style={styles.card}>
          <Text style={styles.label}>Your referral code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{data.code}</Text>
            <Button title="Copy" variant="secondary" size="sm" onPress={copyCode} leftIcon="copy-outline" />
          </View>
          <Button title="Share invite link" onPress={shareLink} leftIcon="share-outline" style={styles.shareButton} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(360).delay(100)}>
        <Card style={styles.card}>
          <Text style={styles.label}>Discount banked for your next payment</Text>
          <Text style={styles.discount}>{data.discountPercentBanked}%</Text>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(360).delay(140)}>
        <Card style={styles.card}>
          <View style={styles.referralsHeader}>
            <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.label}>People you&apos;ve referred</Text>
          </View>
          {data.referrals.length === 0 ? (
            <Text style={styles.emptyReferrals}>No referrals yet — share your code to get started.</Text>
          ) : (
            data.referrals.map((r, i) => (
              <View key={i} style={styles.referralRow}>
                <Text style={styles.referralName}>{r.shopName}</Text>
                <View style={[styles.statusChip, { backgroundColor: r.status === 'converted' ? Colors.successSubtle : Colors.background }]}>
                  <Text style={[styles.statusText, { color: r.status === 'converted' ? Colors.success : Colors.textSecondary }]}>
                    {r.status === 'converted' ? 'Converted' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },
  intro: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  card: { gap: Spacing.sm },
  label: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  code: {
    fontSize: 22,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primaryDark,
    letterSpacing: 3,
  },
  shareButton: { marginTop: Spacing.xs },
  discount: {
    fontSize: 32,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
  },
  referralsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptyReferrals: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  referralName: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.text,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  emptyText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
