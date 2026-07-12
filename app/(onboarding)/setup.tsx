import React, { useState, useMemo } from 'react';
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
  shopName: z.string().min(2, 'Give your shop a name — 2 characters or more'),
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
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸' },
];

type StepKind = 'field' | 'country' | 'county' | 'subCounty' | 'currency' | 'founder';

/** One question per screenful. `field` only applies to `kind: 'field'` steps —
 *  everything else (country/county/sub-county/currency/founder) is plain
 *  local state, same pattern the currency step already used. */
const STEPS: {
  kind: StepKind;
  field?: keyof SetupForm;
  title: string;
  subtitle: string;
}[] = [
  {
    kind: 'field',
    field: 'shopName',
    title: 'What’s your shop called?',
    subtitle: 'This goes on your receipts and reports.',
  },
  {
    kind: 'field',
    field: 'ownerName',
    title: 'And your name?',
    subtitle: 'You’ll be the owner of this shop.',
  },
  {
    kind: 'field',
    field: 'phone',
    title: 'Your business phone?',
    subtitle: 'For M-PESA payment notifications. You can skip this.',
  },
  {
    kind: 'country',
    title: 'Which country do you operate in?',
    subtitle: 'Sets your defaults — you can change this any time.',
  },
  {
    kind: 'county',
    title: 'Which county?',
    subtitle: 'Helps us tailor tips and offers to your area. Optional.',
  },
  {
    kind: 'subCounty',
    title: 'Which sub-county?',
    subtitle: 'Narrows it down even further. Optional.',
  },
  {
    kind: 'currency',
    title: 'Which currency do you sell in?',
    subtitle: 'You can change this any time in settings.',
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

  // The sub-county step only exists when the chosen county actually has data
  // for it — every country but Kenya today. Recomputed as county changes.
  const visibleSteps = useMemo(
    () => STEPS.filter((s) => s.kind !== 'subCounty' || subCountyOptions.length > 0),
    [subCountyOptions.length]
  );

  const current = visibleSteps[step];
  const isFounderNote = current.kind === 'founder';

  const goNext = async () => {
    if (current.kind === 'field' && current.field) {
      const valid = await trigger(current.field);
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
    if (step < visibleSteps.length - 1) {
      setStep((s) => s + 1);
    } else {
      router.push('/(onboarding)/permissions');
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  };

  const optionalStep =
    (current.kind === 'field' && current.field === 'phone') ||
    current.kind === 'county' ||
    current.kind === 'subCounty';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <JourneyProgress
          step={step + 1}
          total={visibleSteps.length}
          onBack={goBack}
          right={
            optionalStep ? (
              <AnimatedPressable
                onPress={goNext}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Skip this step"
              >
                <Text style={styles.skipText}>Skip</Text>
              </AnimatedPressable>
            ) : undefined
          }
        />

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

            {current.kind === 'field' && current.field === 'shopName' ? (
              <Controller
                control={control}
                name="shopName"
                render={({ field, fieldState }) => (
                  <Input
                    placeholder="Duka la Amani"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    autoCapitalize="words"
                    autoFocus
                    leftIcon="storefront-outline"
                    returnKeyType="next"
                    onSubmitEditing={goNext}
                  />
                )}
              />
            ) : null}

            {current.kind === 'field' && current.field === 'ownerName' ? (
              <Controller
                control={control}
                name="ownerName"
                render={({ field, fieldState }) => (
                  <Input
                    placeholder="Jane Wanjiku"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    autoCapitalize="words"
                    autoFocus
                    leftIcon="person-outline"
                    returnKeyType="next"
                    onSubmitEditing={goNext}
                  />
                )}
              />
            ) : null}

            {current.kind === 'field' && current.field === 'phone' ? (
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    placeholder="+254 700 000 000"
                    value={field.value}
                    onChangeText={field.onChange}
                    keyboardType="phone-pad"
                    autoFocus
                    leftIcon="call-outline"
                    returnKeyType="next"
                    onSubmitEditing={goNext}
                  />
                )}
              />
            ) : null}

            {current.kind === 'country' ? (
              <Animated.View entering={FadeInRight.duration(320).delay(100)} style={styles.currencyList}>
                {COUNTRIES.map((c) => (
                  <ChoiceCard
                    key={c.code}
                    label={`${c.flag}  ${c.name}`}
                    selected={country === c.code}
                    onPress={() => {
                      setCountry(c.code);
                      setCountyId(null);
                      setCountyName('');
                      setSubCountyName('');
                    }}
                  />
                ))}
              </Animated.View>
            ) : null}

            {current.kind === 'county' ? (
              <Animated.View entering={FadeInRight.duration(320).delay(100)}>
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
              </Animated.View>
            ) : null}

            {current.kind === 'subCounty' ? (
              <Animated.View entering={FadeInRight.duration(320).delay(100)}>
                <AnimatedPressable
                  style={styles.pickerField}
                  onPress={() => setShowSubCountyPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Choose sub-county"
                >
                  <Ionicons name="pin-outline" size={18} color={Colors.textTertiary} />
                  <Text style={[styles.pickerFieldText, !subCountyName && styles.pickerFieldPlaceholder]}>
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
              </Animated.View>
            ) : null}

            {current.kind === 'currency' ? (
              <Animated.View
                entering={FadeInRight.duration(320).delay(100)}
                style={styles.currencyList}
              >
                {CURRENCIES.map((c) => (
                  <ChoiceCard
                    key={c.value}
                    label={c.label}
                    subtitle={c.subtitle}
                    selected={currency === c.value}
                    onPress={() => setCurrency(c.value)}
                  />
                ))}
              </Animated.View>
            ) : null}

            {isFounderNote ? (
              <Animated.View entering={FadeInDown.duration(450)} style={styles.founderCard}>
                <Text style={styles.founderWave}>👋</Text>
                <Text style={styles.founderText}>
                  Hi{draft.ownerName ? ` ${draft.ownerName.split(' ')[0]}` : ''},{'\n\n'}
                  We built Smart Duka because small businesses deserve software that works as hard
                  as they do.{'\n\n'}
                  Thank you for trusting us with yours.
                </Text>
                <Image
                  source={{ uri: CEO_SIGN_IMG_URL }}
                  style={styles.founderSign}
                  resizeMode="contain"
                  accessibilityLabel="Michael Maina's signature"
                />
                <Text style={styles.founderSignature}>— Michael Maina</Text>
                <Text style={styles.founderRole}>Founder, Smart Duka</Text>
              </Animated.View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <AnimatedPressable onPress={goNext} style={styles.nextBtn} accessibilityRole="button">
              <Text style={styles.nextBtnText}>
                {isFounderNote ? 'Continue' : current.kind === 'currency' ? 'Looks right' : 'Next'}
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
  skipText: {
    color: Colors.primary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
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
  founderWave: { fontSize: 40, marginBottom: Spacing.md },
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
