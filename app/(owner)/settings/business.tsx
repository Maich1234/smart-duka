import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAlert } from '@/context/AlertContext';
import { useShopConfig } from '@/hooks/useShopConfig';
import { updateShopConfig, uploadShopLogo } from '@/services/shop';
import { ShopSettingsForm } from '@/components/profile/ShopSettingsForm';
import { SettingsCard, SettingsRow, SettingsSectionLabel } from '@/components/settings/SettingsRow';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

export default function BusinessSettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const { toast } = useAlert();
  const queryClient = useQueryClient();

  const [shopEdits, setShopEdits] = useState<Record<string, string | number>>({});
  const [updatingShop, setUpdatingShop] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { shopConfig, loadingShop } = useShopConfig();

  const shop = {
    name: shopConfig?.name ?? '',
    address: shopConfig?.address ?? '',
    phone: shopConfig?.phone ?? '',
    email: shopConfig?.email ?? '',
    taxRate: shopConfig?.taxRate ?? 0,
    country: (shopConfig as any)?.country ?? 'KE',
    currency: shopConfig?.currency ?? 'KES',
    receiptThankYouNote: shopConfig?.receiptThankYouNote ?? '',
    logoUrl: (shopConfig as any)?.logoUrl ?? '',
    motto: (shopConfig as any)?.motto ?? '',
  };
  const displayShop = { ...shop, ...shopEdits };

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
        : "Some access wasn't granted. You can allow it from your device Settings.",
    });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl, paddingTop: Spacing.lg }}>
        <SettingsSectionLabel label="Your shop's profile, tax setup, and receipt branding." />

        <Animated.View entering={FadeInUp.duration(320)} style={styles.wrap}>
          <ShopSettingsForm
            shop={displayShop}
            onChange={(field, value) => setShopEdits((prev) => ({ ...prev, [field]: value }))}
            onSave={handleShopUpdate}
            onPickLogo={handlePickLogo}
            uploadingLogo={uploadingLogo}
            // Also true while the initial fetch is still in flight — every
            // other settings screen disables its control until shopConfig
            // has loaded (see useShopConfigToggle's disabled={toggling ||
            // loadingShop}); this form skipped that, and Save unlocked before
            // the real values arrive would submit a mostly-blank `shop`
            // default, wiping any field the owner hadn't touched yet.
            loading={updatingShop || loadingShop}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(320).delay(60)}>
          <SettingsCard>
            <SettingsRow
              icon="camera-outline"
              title="Photo & Camera Access"
              subtitle="Needed to set your business logo"
              onPress={handleGrantMediaAccess}
              accessibilityLabel="Allow camera and photo access"
            />
          </SettingsCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  wrap: { marginHorizontal: Spacing.lg, marginBottom: 22 },
});
