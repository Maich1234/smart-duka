import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Button } from '@/components/ui/Button';
import { VerificationModal } from './VerificationModal';
import { MpesaConfigForm } from './MpesaConfigForm';
import {
  getPaymentConfig,
  saveMpesaConfig,
  disconnectMpesa,
  type MpesaConfigDetails,
} from '@/services/paymentConfig';

// In-memory verification session — clears on app restart, never touches AsyncStorage
let _verificationToken: string | null = null;
let _tokenExpiresAt = 0;

export function getStoredVerificationToken(): string | null {
  if (!_verificationToken || Date.now() > _tokenExpiresAt) {
    _verificationToken = null;
    return null;
  }
  return _verificationToken;
}

export function storeVerificationToken(token: string) {
  _verificationToken = token;
  _tokenExpiresAt = Date.now() + 10 * 60 * 1000; // 10 min
}

type ConfigView = 'locked' | 'loading' | 'no_config' | 'configured' | 'form';

export const PaymentsSection: React.FC = () => {
  const [view, setView] = useState<ConfigView>('locked');
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [config, setConfig] = useState<MpesaConfigDetails | null>(null);
  const [saving, setSaving] = useState(false);

  // Check if we already have a valid verification session
  useEffect(() => {
    const token = getStoredVerificationToken();
    if (token) loadConfig(token);
  }, []);

  const loadConfig = async (token: string) => {
    setView('loading');
    try {
      const res = await getPaymentConfig(token);
      setConfig(res.data.mpesa);
      setView(res.data.mpesa.consumerKeySet ? 'configured' : 'no_config');
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Token expired — require re-verification
        _verificationToken = null;
        setView('locked');
      } else {
        setView('no_config');
      }
    }
  };

  const handleVerified = (token: string) => {
    storeVerificationToken(token);
    setVerificationVisible(false);
    loadConfig(token);
  };

  const handleSaveConfig = async (data: Parameters<typeof saveMpesaConfig>[0]) => {
    const token = getStoredVerificationToken();
    if (!token) { setView('locked'); return; }
    setSaving(true);
    try {
      await saveMpesaConfig(data, token);
      Alert.alert('M-Pesa Connected', 'Your M-Pesa Business account has been connected successfully.');
      await loadConfig(token);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect M-Pesa',
      'This will remove your M-Pesa integration. Existing transaction records are preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            const token = getStoredVerificationToken();
            if (!token) { setView('locked'); return; }
            try {
              await disconnectMpesa(token);
              setConfig(null);
              setView('no_config');
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to disconnect');
            }
          },
        },
      ]
    );
  };

  // ─── Locked state ─────────────────────────────────────────────────────────

  if (view === 'locked') {
    return (
      <>
        <Animated.View entering={FadeInDown.duration(240)} style={styles.lockedCard}>
          <View style={styles.lockIconWrap}>
            <LinearGradient colors={['#0B1D1B', '#0F2E2A']} style={styles.lockGradient}>
              <Ionicons name="lock-closed" size={20} color="#14B8A6" />
            </LinearGradient>
          </View>
          <Text style={styles.lockTitle}>Identity Verification Required</Text>
          <Text style={styles.lockSub}>
            Payment credentials are protected. Verify your identity to view or manage your M-Pesa integration.
          </Text>
          <Button
            title="Verify Identity"
            leftIcon="shield-checkmark-outline"
            onPress={() => setVerificationVisible(true)}
            style={styles.verifyBtn}
          />
        </Animated.View>
        <VerificationModal
          visible={verificationVisible}
          onVerified={handleVerified}
          onClose={() => setVerificationVisible(false)}
        />
      </>
    );
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={styles.loadingText}>Loading payment settings...</Text>
      </View>
    );
  }

  // ─── No config: invite to connect ─────────────────────────────────────────

  if (view === 'no_config') {
    return (
      <Animated.View entering={FadeInDown.duration(260)}>
        <View style={styles.connectCard}>
          <View style={styles.mpesaLogoRow}>
            <View style={styles.mpesaIconWrap}>
              <Ionicons name="phone-portrait-outline" size={22} color="#4ADE80" />
            </View>
            <View>
              <Text style={styles.mpesaTitle}>Lipa Na M-Pesa Business</Text>
              <Text style={styles.mpesaSub}>Accept M-Pesa payments at checkout</Text>
            </View>
          </View>
          <View style={styles.featureList}>
            {['STK Push — customers pay with their M-Pesa PIN', 'Auto-confirmed receipts with M-Pesa reference', 'Full transaction history and reports'].map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
          <Button
            title="Connect M-Pesa Business"
            leftIcon="add-circle-outline"
            onPress={() => setView('form')}
            style={styles.connectBtn}
          />
        </View>
      </Animated.View>
    );
  }

  // ─── Form: configure / update ─────────────────────────────────────────────

  if (view === 'form') {
    return (
      <Animated.View entering={FadeInDown.duration(260)}>
        <MpesaConfigForm
          onSave={handleSaveConfig}
          loading={saving}
          onCancel={() => setView(config?.consumerKeySet ? 'configured' : 'no_config')}
          initialValues={config ? {
            environment: config.environment,
            businessName: config.businessName,
            shortcode: config.shortcode,
          } : undefined}
          isEditing={!!config?.consumerKeySet}
        />
      </Animated.View>
    );
  }

  // ─── Configured: show masked credentials ──────────────────────────────────

  return (
    <Animated.View entering={FadeInDown.duration(260)}>
      {/* Status banner */}
      <View style={styles.statusBanner}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Connected</Text>
        <View style={styles.envBadge}>
          <Text style={styles.envBadgeText}>
            {config?.environment === 'production' ? '🌐 Production' : '🔧 Sandbox'}
          </Text>
        </View>
      </View>

      {/* Business info */}
      <InfoRow icon="business-outline" label="Business Name" value={config?.businessName ?? '—'} />
      <InfoRow icon="keypad-outline" label="Shortcode" value={config?.shortcode ?? '—'} />

      {/* Masked credentials */}
      <View style={styles.credentialGroup}>
        <Text style={styles.credGroupLabel}>API CREDENTIALS</Text>
        <CredentialRow
          label="Consumer Key"
          isSet={config?.consumerKeySet ?? false}
          maskedValue={config?.consumerKeyMasked ?? null}
        />
        <CredentialRow
          label="Consumer Secret"
          isSet={config?.consumerSecretSet ?? false}
          maskedValue={config?.consumerSecretMasked ?? null}
        />
        <CredentialRow
          label="Passkey"
          isSet={config?.passkeySet ?? false}
          maskedValue={config?.passkeyMasked ?? null}
        />
      </View>

      {config?.configuredAt && (
        <Text style={styles.configuredAt}>
          Last updated {new Date(config.configuredAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      )}

      <View style={styles.actionRow}>
        <Button
          title="Edit Configuration"
          variant="secondary"
          leftIcon="create-outline"
          onPress={() => setView('form')}
          style={styles.editBtn}
        />
        <Button
          title="Disconnect"
          variant="danger"
          leftIcon="unlink-outline"
          onPress={handleDisconnect}
          style={styles.disconnectBtn}
        />
      </View>
    </Animated.View>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={14} color={Colors.primary} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const CredentialRow: React.FC<{ label: string; isSet: boolean; maskedValue: string | null }> = ({
  label,
  isSet,
  maskedValue,
}) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.credRow}>
      <View style={styles.credRowTop}>
        <View style={styles.credRowLeft}>
          <Ionicons name="key-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.credLabel}>{label}</Text>
        </View>
        {isSet ? (
          <View style={styles.credSetBadge}>
            <Ionicons name="checkmark" size={10} color={Colors.success} />
            <Text style={styles.credSetText}>Set</Text>
          </View>
        ) : (
          <Text style={styles.credNotSet}>Not set</Text>
        )}
      </View>
      {isSet && (
        <View style={styles.credValueRow}>
          <Text style={styles.credMasked} selectable>
            {revealed ? (maskedValue ?? '••••••••••••••••') : '••••••••••••••••'}
          </Text>
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={14}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Locked
  lockedCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    gap: 10,
  },
  lockIconWrap: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  lockGradient: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  lockSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 17,
  },
  verifyBtn: { width: '100%' },
  // Loading
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: Typography.size.small,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  // Connect card
  connectCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
    gap: 12,
  },
  mpesaLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mpesaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#052e16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mpesaTitle: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  mpesaSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 2,
  },
  featureList: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  featureText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    flex: 1,
  },
  connectBtn: {},
  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
    padding: 10,
    backgroundColor: Colors.successSubtle,
    borderRadius: 10,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
    flex: 1,
  },
  envBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  envBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  infoValue: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
    marginTop: 1,
  },
  // Credential group
  credentialGroup: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  credGroupLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    padding: 8,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  credRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  credRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  credRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  credLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
  },
  credValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 19,
  },
  credMasked: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    fontFamily: 'Courier New',
    letterSpacing: 1.5,
  },
  revealBtn: {
    padding: 2,
  },
  credSetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.successSubtle,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  credSetText: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
  },
  credNotSet: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  configuredAt: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  // Actions
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  editBtn: { flex: 2 },
  disconnectBtn: { flex: 1 },
});
