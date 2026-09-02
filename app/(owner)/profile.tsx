import React from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useAlert } from '@/context/AlertContext';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { getShopConfig } from '@/services/shop';
import { getOwnerDashboard } from '@/services/dashboard';
import { getStaff } from '@/services/staff';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { DeleteAccountSection } from '@/components/profile/DeleteAccountSection';
import { LegalSection } from '@/components/profile/LegalSection';
import { SettingsCard, SettingsRow, SettingsRowDivider } from '@/components/settings/SettingsRow';
import { useSubscription } from '@/hooks/useSubscription';
import { describeSubscription, type SubscriptionTone } from '@/utils/subscriptionStatus';
import { openHelp } from '@/utils/openHelp';
import { openWebPage } from '@/utils/openWebPage';
import { useWarmUpBrowser } from '@/hooks/useWarmUpBrowser';
import { WEB_URL } from '@/constants/config';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

const { width: W } = Dimensions.get('window');
const STAT_W = (W - Spacing.lg * 2 - 10) / 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || 'SD';

const fmtCurrency = (n: number, currency = 'KES') =>
  `${currency} ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

// Subscription tones, twice over: the hero sits on a near-black gradient and
// needs light ink, the preferences row sits on white and needs dark ink.
const HERO_TONE: Record<SubscriptionTone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: 'rgba(255,255,255,0.72)', bg: 'rgba(255,255,255,0.10)', border: 'rgba(255,255,255,0.16)' },
  info: { fg: '#5EEAD4', bg: 'rgba(20,184,166,0.18)', border: 'rgba(94,234,212,0.22)' },
  good: { fg: '#4ADE80', bg: 'rgba(21,128,61,0.18)', border: 'rgba(74,222,128,0.20)' },
  warn: { fg: '#FCD34D', bg: 'rgba(245,158,11,0.18)', border: 'rgba(252,211,77,0.24)' },
  urgent: { fg: '#FCA5A5', bg: 'rgba(220,38,38,0.20)', border: 'rgba(252,165,165,0.26)' },
};

const ROW_TONE: Record<SubscriptionTone, { fg: string; bg: string }> = {
  neutral: { fg: Colors.primaryDark, bg: Colors.primarySubtle },
  info: { fg: Colors.primaryDark, bg: Colors.primarySubtle },
  good: { fg: Colors.success, bg: Colors.successSubtle },
  warn: { fg: '#B45309', bg: Colors.warningSubtle },
  urgent: { fg: Colors.danger, bg: Colors.dangerSubtle },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ProfileSkeleton = () => (
  <View style={sk.container}>
    <View style={sk.hero} />
    <View style={sk.row}>
      <View style={[sk.stat, { width: STAT_W }]} />
      <View style={[sk.stat, { width: STAT_W }]} />
    </View>
    <View style={sk.row}>
      <View style={[sk.stat, { width: STAT_W }]} />
      <View style={[sk.stat, { width: STAT_W }]} />
    </View>
    <View style={sk.card} />
    <View style={sk.card} />
  </View>
);

const sk = StyleSheet.create({
  container: { padding: Spacing.lg, gap: 12, backgroundColor: Colors.background, flex: 1 },
  hero: { height: 152, borderRadius: 24, backgroundColor: '#E2E8F0' },
  row: { flexDirection: 'row', gap: 10 },
  stat: { height: 90, borderRadius: 14, backgroundColor: '#E2E8F0' },
  card: { height: 100, borderRadius: 16, backgroundColor: '#E2E8F0', marginTop: 4 },
});

// ─── Section label ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <View style={sl.wrap}>
    <Text style={sl.text}>{label}</Text>
  </View>
);

const sl = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, marginTop: 22, marginBottom: 10 },
  text: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
  },
});

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  iconColor: string;
  iconBg: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, iconColor, iconBg, delay = 0 }) => (
  <Animated.View entering={FadeInUp.duration(360).delay(delay)} style={[sc.card, { width: STAT_W }]}>
    <View style={[sc.iconWrap, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={17} color={iconColor} />
    </View>
    <Text style={sc.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={sc.label}>{label}</Text>
  </Animated.View>
);

const sc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 17,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 14,
  },
});

// ─── Help items ───────────────────────────────────────────────────────────────

interface HelpItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  // Help Center article — opens `${HELP_CENTER_URL}/help/:slug`.
  slug?: string;
  // Any other web-app page (e.g. Contact) — opens `${WEB_URL}${path}` directly,
  // bypassing the /help/:slug convention for destinations that aren't articles.
  path?: string;
}

const HELP_ITEMS: HelpItem[] = [
  { icon: 'book-outline', label: 'Tutorials', sub: 'Learn features', slug: 'getting-started' },
  { icon: 'help-circle-outline', label: 'FAQ', sub: 'Common questions', slug: 'faq' },
  { icon: 'chatbubble-ellipses-outline', label: 'Support', sub: 'Contact us', path: '/contact' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function OwnerProfile() {
  const { user, logout } = useAuth();
  const tabBarHeight = useTabBarHeight();
  const { alert } = useAlert();
  useWarmUpBrowser();

  const handleLogout = () => {
    alert({
      type: 'confirm',
      title: 'Sign out?',
      message: 'You\'ll need to sign back in to access your DuQana account.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Sign out', variant: 'danger', onPress: logout },
      ],
    });
  };

  const { data: shopConfigData, isLoading: loadingShop } = useQuery({
    queryKey: ['shopConfig'],
    queryFn: getShopConfig,
  });

  const { data: dashData, isRefetching: isDashRefetching, refetch: refetchDash } = useQuery({
    queryKey: ['ownerDashboard'],
    queryFn: getOwnerDashboard,
  });

  const { data: staffData, isRefetching: isStaffRefetching, refetch: refetchStaff } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff(),
  });

  // Free-tier shops have no other running countdown, so the profile is where
  // "how long do I have left?" gets answered — in the hero and on the
  // subscription row. Recomputed each render so the day-count follows the
  // clock even when the cached subscription is days old.
  const {
    access: subscriptionAccess,
    plan: subscriptionPlan,
    refetch: refetchSubscription,
  } = useSubscription();
  const subStatus = describeSubscription(subscriptionAccess, subscriptionPlan);

  const handleRefresh = () => {
    refetchDash();
    refetchStaff();
    // Pull-to-refresh is the obvious gesture after paying — the countdown
    // shown here has to be able to clear itself without an app restart.
    refetchSubscription();
  };

  const dashboard = dashData?.data;
  const staffCount = staffData?.data?.length ?? 0;
  const currency = shopConfigData?.data.currency || 'KES';
  const shopName = shopConfigData?.data.name ?? '';
  const userInitials = getInitials(user?.name ?? '');
  const lowStockCount = dashboard?.lowStockItems?.length ?? 0;

  if (loadingShop) {
    return <ProfileSkeleton />;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={isDashRefetching || isStaffRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(480)} style={styles.heroWrap}>
          <LinearGradient
            colors={['#0B1D1B', '#0F2E2A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.orb1} />
            <View style={styles.orb2} />
            <View style={styles.orb3} />

            <View style={styles.heroIdentity}>
              <LinearGradient
                colors={['#0F766E', '#14B8A6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.initialsRing}
              >
                <Text style={styles.initialsText}>{userInitials}</Text>
              </LinearGradient>
              <View style={styles.heroIdentityText}>
                <Text style={styles.heroName} numberOfLines={1}>{user?.name ?? 'Owner'}</Text>
                <View style={styles.ownerPill}>
                  <Ionicons name="shield-checkmark" size={10} color="#5EEAD4" />
                  <Text style={styles.ownerPillText}>Shop Owner</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroFooter}>
              <View style={styles.heroShopRow}>
                <Ionicons name="storefront-outline" size={13} color="rgba(255,255,255,0.45)" />
                <Text style={styles.heroShopName} numberOfLines={1}>
                  {shopName || user?.shop?.name || 'DuQana'}
                </Text>
              </View>
              {/* Was a hardcoded "Active" chip. It now carries the real
                  subscription countdown — the one number a free-tier owner
                  needs to see without going looking for it. */}
              {subStatus && (
                <AnimatedPressable
                  onPress={() => router.push('/(owner)/subscription')}
                  style={[
                    styles.activePill,
                    {
                      backgroundColor: HERO_TONE[subStatus.tone].bg,
                      borderColor: HERO_TONE[subStatus.tone].border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Subscription: ${subStatus.pill}. Opens subscription details.`}
                >
                  <View style={[styles.activeDot, { backgroundColor: HERO_TONE[subStatus.tone].fg }]} />
                  <Text style={[styles.activePillText, { color: HERO_TONE[subStatus.tone].fg }]}>
                    {subStatus.pill}
                  </Text>
                </AnimatedPressable>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── BUSINESS OVERVIEW ─────────────────────────────────────────── */}
        <SectionLabel label="BUSINESS OVERVIEW" />

        <View style={styles.statsRow}>
          <StatCard
            icon="cube-outline"
            label="Total Products"
            value={String(dashboard?.totalProducts ?? '-')}
            iconColor={Colors.primary}
            iconBg={Colors.primarySubtle}
            delay={60}
          />
          <StatCard
            icon="trending-up-outline"
            label="Stock Value"
            value={dashboard != null ? fmtCurrency(dashboard.currentStockValue, currency) : '-'}
            iconColor={Colors.success}
            iconBg={Colors.successSubtle}
            delay={110}
          />
        </View>

        <View style={[styles.statsRow, { marginTop: 10 }]}>
          <StatCard
            icon="cart-outline"
            label="Today's Sales"
            value={dashboard != null ? fmtCurrency(dashboard.todaySalesTotal, currency) : '-'}
            iconColor={Colors.accent}
            iconBg={Colors.accentSubtle}
            delay={160}
          />
          <StatCard
            icon="people-outline"
            label="Staff Members"
            value={String(staffCount)}
            iconColor={Colors.info}
            iconBg="#EFF6FF"
            delay={210}
          />
        </View>

        {lowStockCount > 0 && (
          <Animated.View entering={FadeInUp.duration(340).delay(260)} style={styles.lowStockBanner}>
            <View style={styles.lowStockIconWrap}>
              <Ionicons name="warning-outline" size={15} color="#92400E" />
            </View>
            <Text style={styles.lowStockText}>
              {lowStockCount} item{lowStockCount > 1 ? 's' : ''} running low on stock
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#B45309" />
          </Animated.View>
        )}

        {/* ── ACCOUNT ───────────────────────────────────────────────────── */}
        <SectionLabel label="ACCOUNT" />
        <Animated.View entering={FadeInUp.duration(360).delay(80)} style={styles.sectionWrap}>
          <AccountInfo
            name={user?.name || ''}
            email={user?.email || ''}
            role={user?.role || ''}
          />
        </Animated.View>

        {/* ── SETTINGS ──────────────────────────────────────────────────── */}
        <SectionLabel label="SETTINGS" />
        {/* No sectionWrap here — SettingsCard applies its own horizontal margin. */}
        <Animated.View entering={FadeInUp.duration(360).delay(100)}>
          <SettingsCard>
            <SettingsRow
              icon="business-outline"
              title="Business"
              subtitle="Profile, tax rate & receipt branding"
              onPress={() => router.push('/(owner)/settings/business')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="cart-outline"
              title="POS & Sales"
              subtitle="Payment methods, printer & shift management"
              onPress={() => router.push('/(owner)/settings/pos-sales')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="scan-outline"
              title="Scanning"
              subtitle="Barcode scanning, sound & vibration"
              onPress={() => router.push('/(owner)/settings/scanning')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="cube-outline"
              title="Inventory"
              subtitle="Purchasing module"
              onPress={() => router.push('/(owner)/settings/inventory')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="people-outline"
              title="Staff & Security"
              subtitle="Staff access, commission visibility & password"
              onPress={() => router.push('/(owner)/settings/staff-security')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="link-outline"
              iconColor="#16A34A"
              iconBg="#DCFCE7"
              title="Integrations"
              subtitle="M-Pesa Business"
              onPress={() => router.push('/(owner)/settings/integrations')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="notifications-outline"
              iconColor="#B45309"
              iconBg="#FEF3C7"
              title="Notifications"
              subtitle="Low stock alerts & sales anomalies"
              onPress={() => router.push('/(owner)/settings/notifications')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="bar-chart-outline"
              title="Data & Reports"
              subtitle="Reports, business books & reconciliation"
              onPress={() => router.push('/(owner)/settings/data-reports')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="sparkles-outline"
              title="DuQana AI"
              subtitle="Gemini-powered insights & chat"
              onPress={() => router.push('/(owner)/settings/ai')}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor={ROW_TONE[subStatus?.tone ?? 'neutral'].fg}
              iconBg={ROW_TONE[subStatus?.tone ?? 'neutral'].bg}
              title="Subscription"
              subtitle={subStatus?.detail ?? 'Plan, free trial & M-PESA payments'}
              subtitleColor={
                subStatus?.tone === 'warn' || subStatus?.tone === 'urgent'
                  ? ROW_TONE[subStatus.tone].fg
                  : undefined
              }
              onPress={() => router.push('/(owner)/subscription')}
              accessibilityLabel={subStatus ? `Subscription. ${subStatus.detail}` : 'Manage subscription'}
            />
            <SettingsRowDivider />
            <SettingsRow
              icon="gift-outline"
              iconColor="#0F766E"
              iconBg="#CCFBF1"
              title="Refer & Earn"
              subtitle="Share your code, save on your next payment"
              onPress={() => router.push('/(owner)/refer')}
            />
          </SettingsCard>
        </Animated.View>

        {/* ── HELP & LEARNING ───────────────────────────────────────────── */}
        <SectionLabel label="HELP & LEARNING" />
        <Animated.View entering={FadeInUp.duration(360).delay(150)} style={styles.setupGuideRow}>
          <AnimatedPressable
            style={styles.setupGuideCard}
            onPress={() => router.push('/(owner)/setup-guide' as Parameters<typeof router.push>[0])}
            accessibilityRole="button"
            accessibilityLabel="Open Setup Guide"
          >
            <View style={styles.helpIconWrap}>
              <Ionicons name="rocket-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.setupGuideText}>
              <Text style={styles.setupGuideLabel}>Setup Guide</Text>
              <Text style={styles.setupGuideSub}>Get your shop running, step by step</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </AnimatedPressable>
        </Animated.View>
        <Animated.View entering={FadeInUp.duration(360).delay(160)} style={styles.helpRow}>
          {HELP_ITEMS.map((item) => (
            <AnimatedPressable
              key={item.label}
              style={styles.helpCard}
              onPress={() => (item.path ? openWebPage(`${WEB_URL}${item.path}`) : openHelp(item.slug))}
            >
              <View style={styles.helpIconWrap}>
                <Ionicons name={item.icon} size={20} color={Colors.primary} />
              </View>
              <Text style={styles.helpLabel}>{item.label}</Text>
              <Text style={styles.helpSub}>{item.sub}</Text>
            </AnimatedPressable>
          ))}
        </Animated.View>

        {/* ── LEGAL ─────────────────────────────────────────────────────── */}
        <SectionLabel label="LEGAL" />
        <LegalSection />

        {/* ── SIGN OUT ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(300).delay(180)} style={styles.signOutWrap}>
          <AnimatedPressable style={styles.signOutBtn} onPress={handleLogout}>
            <View style={styles.signOutLeft}>
              <View style={styles.signOutIconWrap}>
                <Ionicons name="log-out-outline" size={17} color={Colors.danger} />
              </View>
              <Text style={styles.signOutText}>Sign out of DuQana</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
          </AnimatedPressable>

          <DeleteAccountSection />
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: Colors.background },

  // Hero
  heroWrap: {
    margin: Spacing.lg,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(20,184,166,0.07)',
    top: -40,
    right: -30,
  },
  orb2: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(200,147,42,0.06)',
    top: 30,
    right: 50,
  },
  orb3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(14,165,233,0.05)',
    bottom: -10,
    left: 100,
  },
  heroIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  initialsRing: {
    width: 58,
    height: 58,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  initialsText: {
    fontSize: 21,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroIdentityText: { flex: 1 },
  heroName: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    backgroundColor: 'rgba(20,184,166,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.2)',
  },
  ownerPillText: {
    fontSize: 11,
    color: '#5EEAD4',
    fontFamily: Typography.fontFamilySemiBold,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 14,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  heroShopName: {
    fontSize: Typography.size.small,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily,
    flex: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(21,128,61,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  activePillText: {
    fontSize: 11,
    color: '#4ADE80',
    fontFamily: Typography.fontFamilySemiBold,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },

  // Low stock banner
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.lg,
    marginTop: 10,
    padding: 11,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lowStockIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowStockText: {
    flex: 1,
    fontSize: Typography.size.small,
    color: '#92400E',
    fontFamily: Typography.fontFamilySemiBold,
  },

  // Section wrapper
  sectionWrap: { marginHorizontal: Spacing.lg },

  // Help
  setupGuideRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  setupGuideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setupGuideText: { flex: 1 },
  setupGuideLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  setupGuideSub: {
    fontSize: 11,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  helpRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  helpCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 13,
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  helpIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  helpLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  helpSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Sign out
  signOutWrap: { marginHorizontal: Spacing.lg, marginTop: Spacing.lg },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  signOutLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signOutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.danger,
  },
});
