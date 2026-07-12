import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

interface Props {
  onSave: (data: {
    environment: 'sandbox' | 'production';
    businessName: string;
    shortcode: string;
    consumerKey?: string;
    consumerSecret?: string;
    passkey?: string;
    initiatorName?: string;
    securityCredential?: string;
  }) => Promise<void>;
  loading?: boolean;
  onCancel?: () => void;
  initialValues?: {
    environment: 'sandbox' | 'production';
    businessName: string;
    shortcode: string;
    initiatorName?: string;
  };
  isEditing?: boolean;
}

export const MpesaConfigForm: React.FC<Props> = ({
  onSave,
  loading = false,
  onCancel,
  initialValues,
  isEditing = false,
}) => {
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(
    initialValues?.environment ?? 'sandbox'
  );
  const [businessName, setBusinessName] = useState(initialValues?.businessName ?? '');
  const [shortcode, setShortcode] = useState(initialValues?.shortcode ?? '');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [initiatorName, setInitiatorName] = useState(initialValues?.initiatorName ?? '');
  const [securityCredential, setSecurityCredential] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!businessName.trim()) e.businessName = 'Business name is required';
    if (!shortcode.trim() || !/^\d{5,7}$/.test(shortcode.trim())) e.shortcode = 'Shortcode must be 5–7 digits';
    if (!isEditing) {
      if (!consumerKey.trim() || consumerKey.trim().length < 10) e.consumerKey = 'Consumer key is required';
      if (!consumerSecret.trim() || consumerSecret.trim().length < 10) e.consumerSecret = 'Consumer secret is required';
      if (!passkey.trim() || passkey.trim().length < 10) e.passkey = 'Passkey is required';
    } else {
      if (consumerKey.trim() && consumerKey.trim().length < 10) e.consumerKey = 'Consumer key must be at least 10 characters';
      if (consumerSecret.trim() && consumerSecret.trim().length < 10) e.consumerSecret = 'Consumer secret must be at least 10 characters';
      if (passkey.trim() && passkey.trim().length < 10) e.passkey = 'Passkey must be at least 10 characters';
    }
    // Refund credentials are optional, but a security credential is useless
    // without the matching initiator name (and too short means a paste error).
    if (securityCredential.trim() && securityCredential.trim().length < 10) e.securityCredential = 'Security credential must be at least 10 characters';
    if (securityCredential.trim() && !initiatorName.trim()) e.initiatorName = 'Initiator name is required with a security credential';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: Parameters<typeof onSave>[0] = {
      environment,
      businessName: businessName.trim(),
      shortcode: shortcode.trim(),
    };
    if (consumerKey.trim()) payload.consumerKey = consumerKey.trim();
    if (consumerSecret.trim()) payload.consumerSecret = consumerSecret.trim();
    if (passkey.trim()) payload.passkey = passkey.trim();
    // Send initiatorName whenever it differs from the stored value (empty clears it)
    if (initiatorName.trim() !== (initialValues?.initiatorName ?? '')) payload.initiatorName = initiatorName.trim();
    if (securityCredential.trim()) payload.securityCredential = securityCredential.trim();
    await onSave(payload);
  };

  return (
    <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.container}>

      {/* Environment toggle */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Environment</Text>
        <View style={styles.envRow}>
          <AnimatedPressable
            style={[styles.envBtn, environment === 'sandbox' && styles.envBtnActive]}
            onPress={() => setEnvironment('sandbox')}
          >
            <Ionicons
              name="code-slash-outline"
              size={14}
              color={environment === 'sandbox' ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.envBtnText, environment === 'sandbox' && styles.envBtnTextActive]}>
              Sandbox
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.envBtn, environment === 'production' && styles.envBtnActive]}
            onPress={() => setEnvironment('production')}
          >
            <Ionicons
              name="globe-outline"
              size={14}
              color={environment === 'production' ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.envBtnText, environment === 'production' && styles.envBtnTextActive]}>
              Production
            </Text>
          </AnimatedPressable>
        </View>
        {environment === 'sandbox' && (
          <View style={styles.envNote}>
            <Ionicons name="information-circle-outline" size={13} color={Colors.info} />
            <Text style={styles.envNoteText}>Sandbox mode — transactions are simulated and no real money moves</Text>
          </View>
        )}
        {environment === 'production' && (
          <View style={[styles.envNote, styles.envNoteWarning]}>
            <Ionicons name="warning-outline" size={13} color={Colors.accent} />
            <Text style={[styles.envNoteText, { color: '#92400E' }]}>Production mode — real money transactions will occur</Text>
          </View>
        )}
      </View>

      {/* Business details */}
      <Text style={styles.sectionTitle}>Business Details</Text>

      <Input
        label="Business Name"
        value={businessName}
        onChangeText={(t) => { setBusinessName(t); setErrors((p) => ({ ...p, businessName: '' })); }}
        leftIcon="business-outline"
        placeholder="ACME Store Ltd"
        error={errors.businessName}
        autoCapitalize="words"
      />
      <Input
        label="M-Pesa Shortcode (Paybill / Till Number)"
        value={shortcode}
        onChangeText={(t) => { setShortcode(t); setErrors((p) => ({ ...p, shortcode: '' })); }}
        leftIcon="keypad-outline"
        placeholder="174379"
        keyboardType="number-pad"
        error={errors.shortcode}
        maxLength={7}
      />

      {/* Credentials */}
      <Text style={styles.sectionTitle}>API Credentials</Text>
      <Text style={styles.credentialNote}>
        These are encrypted with AES-256 before storage. Get them from the{' '}
        <Text style={styles.credentialLink}>Safaricom Developer Portal</Text>.
      </Text>
      {isEditing && (
        <View style={styles.keepExistingNote}>
          <Ionicons name="information-circle-outline" size={13} color={Colors.info} />
          <Text style={styles.keepExistingText}>
            Leave credential fields blank to keep your existing keys.
          </Text>
        </View>
      )}

      <Input
        label="Consumer Key"
        value={consumerKey}
        onChangeText={(t) => { setConsumerKey(t); setErrors((p) => ({ ...p, consumerKey: '' })); }}
        leftIcon="key-outline"
        placeholder={isEditing ? '••••  Leave blank to keep existing' : 'Your app\'s consumer key'}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.consumerKey}
      />
      <Input
        label="Consumer Secret"
        value={consumerSecret}
        onChangeText={(t) => { setConsumerSecret(t); setErrors((p) => ({ ...p, consumerSecret: '' })); }}
        leftIcon="lock-closed-outline"
        placeholder={isEditing ? '••••  Leave blank to keep existing' : 'Your app\'s consumer secret'}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.consumerSecret}
      />
      <Input
        label="Passkey"
        value={passkey}
        onChangeText={(t) => { setPasskey(t); setErrors((p) => ({ ...p, passkey: '' })); }}
        leftIcon="shield-outline"
        placeholder={isEditing ? '••••  Leave blank to keep existing' : 'Your Lipa Na M-Pesa passkey'}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.passkey}
      />

      {/* Refund credentials (optional) */}
      <Text style={styles.sectionTitle}>Refund Credentials (Optional)</Text>
      <Text style={styles.credentialNote}>
        Needed only to send M-Pesa refunds back to customers (Transaction Reversal). Create an API
        operator on the <Text style={styles.credentialLink}>Daraja portal</Text>, then paste the
        Initiator Name and the generated Security Credential here.
      </Text>

      <Input
        label="Initiator Name"
        value={initiatorName}
        onChangeText={(t) => { setInitiatorName(t); setErrors((p) => ({ ...p, initiatorName: '' })); }}
        leftIcon="person-outline"
        placeholder="e.g. testapi"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.initiatorName}
      />
      <Input
        label="Security Credential"
        value={securityCredential}
        onChangeText={(t) => { setSecurityCredential(t); setErrors((p) => ({ ...p, securityCredential: '' })); }}
        leftIcon="shield-checkmark-outline"
        placeholder={isEditing ? '••••  Leave blank to keep existing' : 'Generated on the Daraja portal'}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.securityCredential}
      />

      <View style={styles.actionRow}>
        {onCancel && (
          <Button
            title="Cancel"
            variant="outline"
            onPress={onCancel}
            style={styles.cancelBtn}
          />
        )}
        <Button
          title="Save Configuration"
          onPress={handleSave}
          loading={loading}
          leftIcon="checkmark-circle-outline"
          style={styles.saveBtn}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {},
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  envRow: { flexDirection: 'row', gap: 8 },
  envBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  envBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  envBtnText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
  },
  envBtnTextActive: { color: Colors.primary },
  envNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  envNoteWarning: { backgroundColor: '#FFFBEB' },
  envNoteText: {
    flex: 1,
    fontSize: 11,
    color: Colors.info,
    fontFamily: Typography.fontFamily,
    lineHeight: 15,
  },
  sectionTitle: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  credentialNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    lineHeight: 15,
    marginBottom: 12,
  },
  credentialLink: {
    color: Colors.primary,
    fontFamily: Typography.fontFamilySemiBold,
  },
  keepExistingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    marginBottom: 12,
  },
  keepExistingText: {
    flex: 1,
    fontSize: 11,
    color: Colors.info,
    fontFamily: Typography.fontFamily,
    lineHeight: 15,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1 },
  saveBtn: { flex: 2 },
});
