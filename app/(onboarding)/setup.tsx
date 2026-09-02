import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Image } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Input } from '@/components/ui/Input';
import { JourneyProgress } from '@/components/onboarding/JourneyProgress';
import { ChoiceCard } from '@/components/onboarding/ChoiceCard';
import { SearchablePicker, type PickerOption } from '@/components/onboarding/SearchablePicker';
import { useOnboardingStore } from '@/store/onboardingStore';
import { getCounties, getSubcounties } from '@/services/locations';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';
import { Shadows } from '@/constants/Shadows';
import { CEO_SIGN_IMG_URL } from '@/constants/config';

const setupSchema = z.object({
  shopName: z.string().min(2, 'Give your shop a name, 2 characters or more'),
  ownerName: z.string().min(2, 'Your name helps your team know who’s boss'),
  phone: z.string(),
});

type SetupForm = z.infer<typeof setupSchema>;

const CURRENCIES = [
  { value: 'KES', label: 'Kenyan Shilling', subtitle: 'KSh' },
  { value: 'TZS', label: 'Tanzanian Shilling', subtitle: 'TSh' },
  { value: 'UGX', label: 'Ugandan Shilling', subtitle: 'USh' },
  { value: 'USD', label: 'US Dollar', subtitle: '$' },
];

// East African Community countries this app actively supports today —
// matches constants/presets.js's COUNTRIES on the backend.
const COUNTRIES = [
  { code: 'KE', name: 'Kenya' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BI', name: 'Burundi' },
  { code: 'SS', name: 'South Sudan' },
];

// Pre-selects the currency step once a country is chosen — the owner can
// still override it below. Countries without a listed currency default to
// USD, same as CURRENCIES' fallback.
const DEFAULT_CURRENCY: Record<string, string> = {
  KE: 'KES',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'USD',
  BI: 'USD',
  SS: 'USD',
};

type StepKind = 'basics' | 'location' | 'founder';

const STEPS: { kind: StepKind; title: string; subtitle: string }[] = [
  {
    kind: 'basics',
    title: 'Tell us about your shop',
    subtitle: 'This goes on your receipts and reports.',
  },
  {
    kind: 'location',
    title: 'Where are you, and what currency do you sell in?',
    subtitle: 'Sets your defaults. You can change any of this later in settings.',
  },
  {
    kind: 'founder',
    title: 'A note from our founder',
    subtitle: '',
  },
];

export default function BusinessSetup() {
  const [step, setStep] = useState(0);
  const { draft, setDraft } = useOnboardingStore();
  const [currency, setCurrency] = useState(draft.currency || 'KES');
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [country, setCountry] = useState(draft.country || 'KE');
  const [countyId, setCountyId] = useState<string | null>(null);
  const [countyName, setCountyName] = useState(draft.county || '');
  const [subCountyName, setSubCountyName] = useState(draft.subCounty || '');
  const [showCountyPicker, setShowCountyPicker] = useState(false);
  const [showSubCountyPicker, setShowSubCountyPicker] = useState(false);

  const { control, trigger, getValues } = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    mode: 'onChange',
    defaultValues: {
      shopName: draft.shopName,
      ownerName: draft.ownerName,
      phone: draft.phone,
    },
  });

  const { data: countiesData, isFetching: countiesLoading } = useQuery({
    queryKey: ['onboardingCounties', country],
    queryFn: () => getCounties(country),
  });
  const countyOptions: PickerOption[] = (countiesData?.data ?? []).map((c) => ({ id: c._id, name: c.name }));

  const { data: subcountiesData, isFetching: subcountiesLoading } = useQuery({
    queryKey: ['onboardingSubcounties', countyId],
    queryFn: () => getSubcounties(countyId as string),
    enabled: !!countyId,
  });
  const subCountyOptions: PickerOption[] = (subcountiesData?.data ?? []).map((s) => ({ id: s._id, name: s.name }));

  const current = STEPS[step];
  const isFounderNote = current.kind === 'founder';

  const selectCountry = (code: string) => {
    haptics.selection();
    setCountry(code);
    setCountyId(null);
    setCountyName('');
    setSubCountyName('');
    if (!currencyTouched) setCurrency(DEFAULT_CURRENCY[code] ?? currency);
  };

  const selectCurrency = (value: string) => {
    haptics.selection();
    setCurrency(value);
    setCurrencyTouched(true);
  };

  const goNext = async () => {
    if (current.kind === 'basics') {
      const valid = await trigger(['shopName', 'ownerName']);
      if (!valid) {
        haptics.error();
        return;
      }
    }
    haptics.light();
    const values = getValues();
    setDraft({
      shopName: values.shopName.trim(),
      ownerName: values.ownerName.trim(),
      phone: values.phone.trim(),
      country,
      county: countyName,
      subCounty: subCountyName,
      currency,
    });
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      router.push('/(onboarding)/permissions');
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <JourneyProgress step={step + 1} total={STEPS.length} onBack={goBack} />

        {/* The keyed container itself stays unanimated: a Reanimated-animated
            ancestor above a ScrollView leaves RNGH pressables inside it
            unresponsive on web — so the enter motion lives on the content. */}
        <View key={step} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!isFounderNote ? (
              <>
                <Animated.Text entering={FadeInRight.duration(320)} style={styles.title}>
                  {current.title}
                </Animated.Text>
                <Animated.Text
                  entering={FadeInRight.duration(320).delay(50)}
                  style={styles.subtitle}
                >
                  {current.subtitle}
                </Animated.Text>
              </>
            ) : null}

            {current.kind === 'basics' ? (
              <Animated.View entering={FadeInRight.duration(320).delay(100)}>
                <Controller
                  control={control}
                  name="shopName"
                  render={({ field, fieldState }) => (
                    <Input
                      label="Shop name"
                      placeholder="Duka la Amani"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                      autoCapitalize="words"
                      autoFocus
                      leftIcon="storefront-outline"
                      returnKeyType="next"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="ownerName"
                  render={({ field, fieldState }) => (
                    <Input
                      label="Your name"
                      placeholder="Jane Wanjiku"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                      autoCapitalize="words"
                      leftIcon="person-outline"
                      returnKeyType="next"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      label="Business phone"
                      placeholder="+254 700 000 000"
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="phone-pad"
                      leftIcon="call-outline"
                      hint="For M-PESA payment notifications: optional, add it any time"
                      returnKeyType="done"
                      onSubmitEditing={goNext}
                    />
                  )}
                />
              </Animated.View>
            ) : null}

            {current.kind === 'location' ? (
              <Animated.View entering={FadeInRight.duration(320).delay(100)}>
                <Text style={styles.sectionLabel}>Country</Text>
                <View style={styles.tileGrid}>
                  {COUNTRIES.map((c) => (
                    <ChoiceCard
                      key={c.code}
                      variant="tile"
                      style={styles.tile}
                      icon="flag-outline"
                      label={c.name}
                      selected={country === c.code}
                      onPress={() => selectCountry(c.code)}
                    />
                  ))}
                </View>

                <Text style={styles.sectionLabel}>County (optional)</Text>
                <AnimatedPressable
                  style={styles.pickerField}
                  onPress={() => setShowCountyPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choose county"
                >
                  <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
                  <Text style={[styles.pickerFieldText, !countyName && styles.pickerFieldPlaceholder]}>
                    {countyName || 'Select a county'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
                </AnimatedPressable>
                <SearchablePicker
                  visible={showCountyPicker}
                  title="Select county"
                  options={countyOptions}
                  loading={countiesLoading}
                  selectedId={countyId}
                  onSelect={(o) => {
                    setCountyId(o.id);
                    setCountyName(o.name);
                    setSubCountyName('');
                  }}
                  onClose={() => setShowCountyPicker(false)}
                />

                {subCountyOptions.length > 0 ? (
                  <>
                    <Text style={styles.sectionLabel}>Sub-county (optional)</Text>
                    <AnimatedPressable
                      style={styles.pickerField}
                      onPress={() => setShowSubCountyPicker(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Choose sub-county"
                    >
                      <Ionicons name="pin-outline" size={18} color={Colors.textTertiary} />
                      <Text
                        style={[styles.pickerFieldText, !subCountyName && styles.pickerFieldPlaceholder]}
                      >
                        {subCountyName || 'Select a sub-county'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
                    </AnimatedPressable>
                    <SearchablePicker
                      visible={showSubCountyPicker}
                      title="Select sub-county"
                      options={subCountyOptions}
                      loading={subcountiesLoading}
                      onSelect={(o) => setSubCountyName(o.name)}
                      onClose={() => setShowSubCountyPicker(false)}
                    />
                  </>
                ) : null}

                <Text style={styles.sectionLabel}>Currency</Text>
                <View style={styles.currencyList}>
                  {CURRENCIES.map((c) => (
                    <ChoiceCard
                      key={c.value}
                      label={c.label}
                      subtitle={c.subtitle}
                      selected={currency === c.value}
                      onPress={() => selectCurrency(c.value)}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {isFounderNote ? (
              <Animated.View entering={FadeInDown.duration(450)} style={styles.founderCard}>
                <View style={styles.founderIconWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.founderText}>
                  Hi{draft.ownerName ? ` ${draft.ownerName.split(' ')[0]}` : ''},{'\n\n'}
                  We built DuQana because small businesses deserve software that works as hard
                  as they do.{'\n\n'}
                  Thank you for trusting us with yours.
                </Text>
                <Image
                  source={{ uri: CEO_SIGN_IMG_URL }}
                  style={styles.founderSign}
                  resizeMode="contain"
                  accessibilityLabel="Michael Maina's signature"
                />
                <Text style={styles.founderSignature}>- Michael Maina</Text>
                <Text style={styles.founderRole}>Founder, DuQana</Text>
              </Animated.View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <AnimatedPressable onPress={goNext} style={styles.nextBtn} accessibilityRole="button">
              <Text style={styles.nextBtnText}>
                {isFounderNote ? 'Continue' : current.kind === 'location' ? 'Looks right' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  title: {
    fontSize: Typography.size.h1,
    lineHeight: Typography.lineHeight.h1,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { width: '31%' },
  currencyList: { gap: Spacing.sm },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  pickerFieldText: {
    flex: 1,
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  pickerFieldPlaceholder: { color: Colors.textTertiary },
  founderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sheet,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    ...Shadows.md,
  },
  founderIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  founderText: {
    fontSize: Typography.size.body,
    lineHeight: 26,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  founderSign: {
    width: 140,
    height: 52,
    alignSelf: 'flex-start',
    marginTop: Spacing.lg,
    marginBottom: -Spacing.sm,
  },
  founderSignature: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  founderRole: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
