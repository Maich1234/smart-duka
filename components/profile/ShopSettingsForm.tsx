import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SelectPicker, type PickerOption } from '../ui/SelectPicker';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { PaymentsSection } from '@/components/payments/PaymentsSection';
import { COUNTRIES, CURRENCIES, getCountryByCode } from '@/constants/presets';

interface ShopSettingsFormProps {
  shop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    taxRate: number;
    country: string;
    currency: string;
    receiptThankYouNote?: string;
    logoUrl?: string;
    motto?: string;
  };
  onChange: (field: keyof ShopSettingsFormProps['shop'], value: string | number) => void;
  onSave: () => void;
  onPickLogo?: () => Promise<void>;
  uploadingLogo?: boolean;
  loading?: boolean;
}

// ─── Collapsible section ──────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isLast?: boolean;
}

const CollapsibleSection: React.FC<SectionProps> = ({
  title,
  description,
  icon,
  iconColor,
  iconBg,
  children,
  defaultExpanded = false,
  isLast = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotation = useSharedValue(defaultExpanded ? 1 : 0);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    rotation.value = withSpring(next ? 1 : 0, { damping: 16, stiffness: 220 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 90])}deg` }],
  }));

  return (
    <View style={[ss.wrapper, !isLast && ss.wrapperBorder]}>
      <AnimatedPressable style={ss.header} onPress={toggle}>
        <View style={[ss.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <View style={ss.headerText}>
          <Text style={ss.title}>{title}</Text>
          <Text style={ss.description}>{description}</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
        </Animated.View>
      </AnimatedPressable>

      {expanded && <View style={ss.content}>{children}</View>}
    </View>
  );
};

const ss = StyleSheet.create({
  wrapper: { },
  wrapperBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily,
    marginTop: 1,
  },
  content: { paddingBottom: 14 },
});

// ─── Main form ────────────────────────────────────────────────────────────────

export const ShopSettingsForm: React.FC<ShopSettingsFormProps> = ({
  shop,
  onChange,
  onSave,
  onPickLogo,
  uploadingLogo = false,
  loading = false,
}) => {
  return (
    <View style={styles.card}>

      {/* ── Contact Information ────────────────────────────────────── */}
      <CollapsibleSection
        title="Contact Information"
        description="Shop name, address & contact details"
        icon="business-outline"
        iconColor={Colors.primary}
        iconBg={Colors.primarySubtle}
        defaultExpanded
      >
        <Input
          label="Shop Name"
          value={shop.name}
          onChangeText={(t) => onChange('name', t)}
          leftIcon="storefront-outline"
        />
        <Input
          label="Address"
          value={shop.address}
          onChangeText={(t) => onChange('address', t)}
          leftIcon="location-outline"
        />
        <Input
          label="Phone"
          value={shop.phone}
          onChangeText={(t) => onChange('phone', t)}
          leftIcon="call-outline"
          keyboardType="phone-pad"
        />
        <Input
          label="Email"
          value={shop.email}
          onChangeText={(t) => onChange('email', t)}
          leftIcon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </CollapsibleSection>

      {/* ── Financial Settings ─────────────────────────────────────── */}
      <CollapsibleSection
        title="Financial Settings"
        description="Country, currency & tax configuration"
        icon="calculator-outline"
        iconColor={Colors.accent}
        iconBg={Colors.accentSubtle}
      >
        <SelectPicker
          label="Country"
          value={shop.country || 'KE'}
          options={COUNTRIES.map((c): PickerOption => ({
            value: c.code,
            label: c.name,
            sublabel: `${c.currency} · ${c.phonePrefix}`,
            leftEmoji: c.flag,
          }))}
          onChange={(code) => {
            const country = getCountryByCode(code);
            onChange('country', code);
            if (country) onChange('currency', country.currency);
          }}
          leftIcon="globe-outline"
          searchable
        />
        <SelectPicker
          label="Currency"
          value={shop.currency || 'KES'}
          options={CURRENCIES.map((c): PickerOption => ({
            value: c.code,
            label: c.name,
            leftEmoji: c.flag,
            rightText: c.code,
          }))}
          onChange={(code) => onChange('currency', code)}
          leftIcon="cash-outline"
        />
        <Input
          label="Tax Rate (%)"
          value={String(shop.taxRate)}
          onChangeText={(t) => onChange('taxRate', parseFloat(t) || 0)}
          leftIcon="receipt-outline"
          keyboardType="numeric"
        />
      </CollapsibleSection>

      {/* ── Receipt Branding ───────────────────────────────────────── */}
      <CollapsibleSection
        title="Receipt Branding"
        description="Logo, tagline & closing message"
        icon="document-text-outline"
        iconColor={Colors.info}
        iconBg="#EFF6FF"
      >
        {/* Logo picker */}
        <Text style={styles.fieldLabel}>Business Logo</Text>
        <AnimatedPressable
          style={styles.logoPicker}
          onPress={onPickLogo}
          disabled={uploadingLogo}
        >
          {uploadingLogo ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : shop.logoUrl ? (
            <>
              <Image source={{ uri: shop.logoUrl }} style={styles.logoPreview} resizeMode="contain" />
              <View style={styles.logoOverlay}>
                <Ionicons name="camera-outline" size={16} color="#fff" />
                <Text style={styles.logoOverlayText}>Change</Text>
              </View>
            </>
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="image-outline" size={28} color={Colors.textTertiary} />
              <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
            </View>
          )}
        </AnimatedPressable>

        <Input
          label="Business Motto / Tagline"
          value={shop.motto ?? ''}
          onChangeText={(t) => onChange('motto', t)}
          leftIcon="sparkles-outline"
          placeholder="Quality you can trust"
          maxLength={200}
        />
        <Input
          label="Thank-You Note"
          value={shop.receiptThankYouNote ?? ''}
          onChangeText={(t) => onChange('receiptThankYouNote', t)}
          leftIcon="heart-outline"
          placeholder="Thank you, dear customer!"
          multiline
          maxLength={150}
        />
      </CollapsibleSection>

      {/* ── Payments ───────────────────────────────────────────────── */}
      <CollapsibleSection
        title="Payments"
        description="M-Pesa Business integration"
        icon="card-outline"
        iconColor="#16A34A"
        iconBg="#DCFCE7"
        isLast
      >
        <PaymentsSection />
      </CollapsibleSection>

      <Button
        title="Save Business Settings"
        onPress={onSave}
        loading={loading}
        leftIcon="checkmark-circle-outline"
        style={styles.saveBtn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  fieldLabel: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  logoPicker: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  logoPreview: {
    width: 90,
    height: 90,
  },
  logoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  logoOverlayText: {
    fontSize: 11,
    color: '#fff',
    fontFamily: Typography.fontFamilySemiBold,
  },
  logoPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  logoPlaceholderText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily,
  },
  saveBtn: { marginVertical: Spacing.md },
});
