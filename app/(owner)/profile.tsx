import React, { useState, useEffect, useMemo } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
  RefreshControl,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useAlert } from '@/context/AlertContext';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { getShopConfig, updateShopConfig, uploadShopLogo, type ShopConfigResponse } from '@/services/shop';
import { changePassword } from '@/services/auth';
import { getOwnerDashboard } from '@/services/dashboard';
import { getStaff } from '@/services/staff';
import {
  getNotificationsPreference,
  setNotificationsPreference,
  registerDeviceForNotifications,
  unregisterDeviceFromNotifications,
} from '@/services/notifications';
import { ShopSettingsForm } from '@/components/profile/ShopSettingsForm';
import { AccountInfo } from '@/components/profile/AccountInfo';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { DeleteAccountSection } from '@/components/profile/DeleteAccountSection';
import { LegalSection } from '@/components/profile/LegalSection';
import { DukanaAiSection } from '@/components/profile/DukanaAiSection';
import { useAiAccess } from '@/hooks/useAiAccess';
import { useSubscription } from '@/hooks/useSubscription';
import { describeSubscription, type SubscriptionTone } from '@/utils/subscriptionStatus';
import { usePrinterStore } from '@/store/printerStore';
import { resolveSaleMethods } from '@/constants/paymentMethods';
import { openHelp } from '@/utils/openHelp';
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
  slug?: string;
}

const HELP_ITEMS: HelpItem[] = [
  { icon: 'book-outline', label: 'Tutorials', sub: 'Learn features', slug: 'getting-started' },
  { icon: 'help-circle-outline', label: 'FAQ', sub: 'Common questions', slug: 'faq' },
  { icon: 'chatbubble-ellipses-outline', label: 'Support', sub: 'Contact us', slug: 'support' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function OwnerProfile() {
  const { user, logout } = useAuth();
  const tabBarHeight = useTabBarHeight();
  const { toast, alert } = useAlert();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    alert({
      type: 'confirm',
      title: 'Sign out?',
      message: 'You\'ll need to sign back in to access your Dukana account.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        { label: 'Sign out', variant: 'danger', onPress: logout },
      ],
    });
  };

  const [shopEdits, setShopEdits] = useState<Record<string, string | number>>({});
  const [updatingShop, setUpdatingShop] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [togglingShifts, setTogglingShifts] = useState(false);
  const [togglingCommissionVisibility, setTogglingCommissionVisibility] = useState(false);
  const [togglingPurchasing, setTogglingPurchasing] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const savedPrinter = usePrinterStore((s) => s.printer);

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

  useEffect(() => {
    getNotificationsPreference().then(setNotificationsEnabled);
  }, []);

  const shop = {
    name: shopConfigData?.data.name ?? '',
    address: shopConfigData?.data.address ?? '',
    phone: shopConfigData?.data.phone ?? '',
    email: shopConfigData?.data.email ?? '',
    taxRate: shopConfigData?.data.taxRate ?? 0,
    country: (shopConfigData?.data as any)?.country ?? 'KE',
    currency: shopConfigData?.data.currency ?? 'KES',
    receiptThankYouNote: shopConfigData?.data.receiptThankYouNote ?? '',
    logoUrl: (shopConfigData?.data as any)?.logoUrl ?? '',
    motto: (shopConfigData?.data as any)?.motto ?? '',
  };
  const displayShop = { ...shop, ...shopEdits };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await setNotificationsPreference(enabled);
    if (enabled) await registerDeviceForNotifications();
    else await unregisterDeviceFromNotifications();
  };

  const handleGrantMediaAccess = async () => {
    const [camera, media] = await Promise.all([
      ImagePicker.requestCameraPermissionsAsync(),
      ImagePicker.requestMediaLibraryPermissionsAsync(),
    ]);
    const granted = camera.granted && media.granted;
    toast({
      type: granted ? 'success' : 'warning',
      message: granted
        ? 'Camera and photo access granted'
        : 'Some access wasn\'t granted — you can allow it from your device Settings.',
    });
  };

  // Names the buttons the till is currently offering, so the owner can see the
  // setup without opening the screen.
  const paymentMethodsSummary = useMemo(() => {
    const active = resolveSaleMethods(shopConfigData?.data?.paymentMethods);
    if (active.length <= 3) return active.map((m) => m.label).join(' · ');
    return `${active.slice(0, 2).map((m) => m.label).join(' · ')} + ${active.length - 2} more`;
  }, [shopConfigData]);

  const shiftManagementEnabled = shopConfigData?.data?.shiftManagementEnabled ?? false;
  const handleToggleShiftManagement = async (enabled: boolean) => {
    const previous = queryClient.getQueryData<ShopConfigResponse>(['shopConfig']);

    queryClient.setQueryData<ShopConfigResponse>(['shopConfig'], (old) =>
      old ? { ...old, data: { ...old.data, shiftManagementEnabled: enabled } } : old
    );
    setTogglingShifts(true);
    try {
      await updateShopConfig({ shiftManagementEnabled: enabled });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      queryClient.invalidateQueries({ queryKey: ['activeShift'] });
      toast({
        type: 'success',
        message: enabled
          ? 'Shift management is on — staff clock in before selling'
          : 'Shift management is off',
      });
    } catch (error: any) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: error.response?.data?.message || 'Could not update the setting' });
    } finally {
      setTogglingShifts(false);
    }
  };

  const purchasingEnabled = shopConfigData?.data?.purchasingEnabled ?? false;
  const handleTogglePurchasing = async (enabled: boolean) => {
    const previous = queryClient.getQueryData<ShopConfigResponse>(['shopConfig']);

    queryClient.setQueryData<ShopConfigResponse>(['shopConfig'], (old) =>
      old ? { ...old, data: { ...old.data, purchasingEnabled: enabled } } : old
    );
    setTogglingPurchasing(true);
    try {
      await updateShopConfig({ purchasingEnabled: enabled });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      toast({
        type: 'success',
        message: enabled
          ? 'Purchasing is on — record stock purchases from the Purchases tab'
          : 'Purchasing is off and hidden from navigation',
      });
    } catch (error: any) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: error.response?.data?.message || 'Could not update the setting' });
    } finally {
      setTogglingPurchasing(false);
    }
  };

  const showStaffCommission = shopConfigData?.data?.showStaffCommission ?? false;
  const handleToggleStaffCommission = async (enabled: boolean) => {
    const previous = queryClient.getQueryData<ShopConfigResponse>(['shopConfig']);

    queryClient.setQueryData<ShopConfigResponse>(['shopConfig'], (old) =>
      old ? { ...old, data: { ...old.data, showStaffCommission: enabled } } : old
    );
    setTogglingCommissionVisibility(true);
    try {
      await updateShopConfig({ showStaffCommission: enabled });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      toast({
        type: 'success',
        message: enabled
          ? 'Staff can now preview and track their commission'
          : 'Commission is now hidden from staff',
      });
    } catch (error: any) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: error.response?.data?.message || 'Could not update the setting' });
    } finally {
      setTogglingCommissionVisibility(false);
    }
  };

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

  const { state: aiAccessState, aiEnabled } = useAiAccess();
  const handleToggleAi = async (enabled: boolean) => {
    const previous = queryClient.getQueryData<ShopConfigResponse>(['shopConfig']);

    queryClient.setQueryData<ShopConfigResponse>(['shopConfig'], (old) =>
      old ? { ...old, data: { ...old.data, aiEnabled: enabled } } : old
    );
    setTogglingAi(true);
    try {
      await updateShopConfig({ aiEnabled: enabled });
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
      queryClient.invalidateQueries({ queryKey: ['aiInsight'] });
      toast({
        type: 'success',
        message: enabled ? 'Dukana AI is on' : 'Dukana AI is off — no data is sent to Gemini',
      });
    } catch (error: any) {
      queryClient.setQueryData(['shopConfig'], previous);
      toast({ type: 'error', message: error.response?.data?.message || 'Could not update the setting' });
    } finally {
      setTogglingAi(false);
    }
  };

  const handleShopUpdate = async () => {
    setUpdatingShop(true);
    try {
      const { name, address, phone, email, taxRate, country, currency, receiptThankYouNote, logoUrl, motto } = displayShop;
      await updateShopConfig({ name, address, phone, email, taxRate, country, currency, receiptThankYouNote, logoUrl, motto } as any);
      toast({ type: 'success', message: 'Shop information updated' });
      setShopEdits({});
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Update failed' });
    } finally {
      setUpdatingShop(false);
    }
  };

  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast({ type: 'warning', message: 'Please allow access to your photo library to upload a logo.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploadingLogo(true);
    try {
      const { logoUrl } = await uploadShopLogo(asset.uri, asset.mimeType ?? 'image/jpeg');
      setShopEdits((prev) => ({ ...prev, logoUrl }));
      queryClient.invalidateQueries({ queryKey: ['shopConfig'] });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Could not upload logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePasswordChange = async (current: string, newPwd: string) => {
    setUpdatingPassword(true);
    try {
      await changePassword(current, newPwd);
      toast({ type: 'success', message: 'Password changed successfully' });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Password change failed' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleRefresh = () => {
    refetchDash();
    refetchStaff();
    // Pull-to-refresh is the obvious gesture after paying — the countdown
    // shown here has to be able to clear itself without an app restart.
    refetchSubscription();
  };

  const dashboard = dashData?.data;
  const staffCount = staffData?.data?.length ?? 0;
  const currency = shop.currency || 'KES';
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
                  {shop.name || user?.shop?.name || 'Dukana'}
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
            value={String(dashboard?.totalProducts ?? '—')}
            iconColor={Colors.primary}
            iconBg={Colors.primarySubtle}
            delay={60}
          />
          <StatCard
            icon="trending-up-outline"
            label="Stock Value"
            value={dashboard != null ? fmtCurrency(dashboard.currentStockValue, currency) : '—'}
            iconColor={Colors.success}
            iconBg={Colors.successSubtle}
            delay={110}
          />
        </View>

        <View style={[styles.statsRow, { marginTop: 10 }]}>
          <StatCard
            icon="cart-outline"
            label="Today's Sales"
            value={dashboard != null ? fmtCurrency(dashboard.todaySalesTotal, currency) : '—'}
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

        {/* ── BUSINESS SETTINGS ─────────────────────────────────────────── */}
        <SectionLabel label="BUSINESS SETTINGS" />
        <Animated.View entering={FadeInUp.duration(360).delay(100)} style={styles.sectionWrap}>
          <ShopSettingsForm
            shop={displayShop}
            onChange={(field, value) => setShopEdits((prev) => ({ ...prev, [field]: value }))}
            onSave={handleShopUpdate}
            onPickLogo={handlePickLogo}
            uploadingLogo={uploadingLogo}
            loading={updatingShop}
          />
        </Animated.View>

        {/* ── PREFERENCES ───────────────────────────────────────────────── */}
        <SectionLabel label="PREFERENCES" />
        <Animated.View entering={FadeInUp.duration(360).delay(120)} style={styles.sectionWrap}>
          <View style={styles.prefCard}>
            <View style={styles.prefRow}>
              <View style={[styles.prefIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="notifications-outline" size={17} color="#B45309" />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Push Notifications</Text>
                <Text style={styles.prefSub}>Low stock alerts & sales anomalies</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={notificationsEnabled ? Colors.primary : Colors.textTertiary}
              />
            </View>

            <View style={styles.prefDivider} />

            <AnimatedPressable
              style={styles.prefRow}
              onPress={handleGrantMediaAccess}
              accessibilityRole="button"
              accessibilityLabel="Allow camera and photo access"
            >
              <View style={[styles.prefIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Ionicons name="camera-outline" size={17} color={Colors.primary} />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Photo & Camera Access</Text>
                <Text style={styles.prefSub}>Needed to set your business logo</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </AnimatedPressable>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={[styles.prefIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="time-outline" size={17} color="#B91C1C" />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Shift Management</Text>
                <Text style={styles.prefSub}>Staff clock in & reconcile the till; daily summary at close</Text>
              </View>
              <Switch
                value={shiftManagementEnabled}
                onValueChange={handleToggleShiftManagement}
                disabled={togglingShifts || loadingShop}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={shiftManagementEnabled ? Colors.primary : Colors.textTertiary}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={[styles.prefIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Ionicons name="cash-outline" size={17} color={Colors.primary} />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Show Commission to Staff</Text>
                <Text style={styles.prefSub}>Let staff preview and track their earned commission</Text>
              </View>
              <Switch
                value={showStaffCommission}
                onValueChange={handleToggleStaffCommission}
                disabled={togglingCommissionVisibility || loadingShop}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={showStaffCommission ? Colors.primary : Colors.textTertiary}
              />
            </View>

            <View style={styles.prefDivider} />

            <View style={styles.prefRow}>
              <View style={[styles.prefIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Ionicons name="cart-outline" size={17} color={Colors.primary} />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Enable Purchasing Module</Text>
                <Text style={styles.prefSub}>Record stock purchases from suppliers and update inventory automatically</Text>
              </View>
              <Switch
                value={purchasingEnabled}
                onValueChange={handleTogglePurchasing}
                disabled={togglingPurchasing || loadingShop}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={purchasingEnabled ? Colors.primary : Colors.textTertiary}
              />
            </View>

            <View style={styles.prefDivider} />

            <AnimatedPressable
              style={styles.prefRow}
              onPress={() => router.push('/(owner)/payment-methods')}
              accessibilityRole="button"
              accessibilityLabel="Choose the payment buttons shown at the till"
            >
              <View style={[styles.prefIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Ionicons name="wallet-outline" size={17} color={Colors.primary} />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Payment Methods</Text>
                <Text style={styles.prefSub}>
                  {paymentMethodsSummary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </AnimatedPressable>

            <View style={styles.prefDivider} />

            <AnimatedPressable
              style={styles.prefRow}
              onPress={() => router.push('/(owner)/printer')}
              accessibilityRole="button"
              accessibilityLabel="Set up a Bluetooth receipt printer"
            >
              <View style={[styles.prefIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Ionicons name="print-outline" size={17} color={Colors.primary} />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Receipt Printer</Text>
                <Text style={styles.prefSub}>
                  {savedPrinter
                    ? `${savedPrinter.name} · ${savedPrinter.paperWidth}mm`
                    : 'Print straight to a Bluetooth thermal printer'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </AnimatedPressable>

            <View style={styles.prefDivider} />

            <AnimatedPressable
              style={styles.prefRow}
              onPress={() => router.push('/(owner)/subscription')}
              accessibilityRole="button"
              accessibilityLabel={
                subStatus ? `Subscription. ${subStatus.detail}` : 'Manage subscription'
              }
            >
              <View
                style={[
                  styles.prefIconWrap,
                  { backgroundColor: ROW_TONE[subStatus?.tone ?? 'neutral'].bg },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color={ROW_TONE[subStatus?.tone ?? 'neutral'].fg}
                />
              </View>
              <View style={styles.prefText}>
                <Text style={styles.prefTitle}>Subscription</Text>
                <Text
                  style={[
                    styles.prefSub,
                    subStatus?.tone === 'warn' || subStatus?.tone === 'urgent'
                      ? { color: ROW_TONE[subStatus.tone].fg, fontFamily: Typography.fontFamilySemiBold }
                      : null,
                  ]}
                >
                  {/* Falls back to the old static line only while the
                      subscription query is still in flight. */}
                  {subStatus?.detail ?? 'Plan, free trial & M-PESA payments'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </AnimatedPressable>
          </View>
        </Animated.View>

        {/* ── DUKANA AI ─────────────────────────────────────────────────── */}
        <SectionLabel label="DUKANA AI" />
        <Animated.View entering={FadeInUp.duration(360).delay(130)} style={styles.sectionWrap}>
          <DukanaAiSection
            state={aiAccessState}
            aiEnabled={aiEnabled}
            toggling={togglingAi}
            loadingShop={loadingShop}
            onToggle={handleToggleAi}
          />
        </Animated.View>

        {/* ── SECURITY ──────────────────────────────────────────────────── */}
        <SectionLabel label="SECURITY" />
        <Animated.View entering={FadeInUp.duration(360).delay(140)} style={styles.sectionWrap}>
          <ChangePasswordForm
            onChangePassword={handlePasswordChange}
            loading={updatingPassword}
          />
        </Animated.View>

        {/* ── HELP & LEARNING ───────────────────────────────────────────── */}
        <SectionLabel label="HELP & LEARNING" />
        <Animated.View entering={FadeInUp.duration(360).delay(160)} style={styles.helpRow}>
          {HELP_ITEMS.map((item) => (
            <AnimatedPressable
              key={item.label}
              style={styles.helpCard}
              onPress={() => openHelp(item.slug)}
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
              <Text style={styles.signOutText}>Sign out of Dukana</Text>
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

  // Preferences
  prefCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.md },
  prefIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefText: { flex: 1 },
  prefTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  prefSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },

  // Help
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
