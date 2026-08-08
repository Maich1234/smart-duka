import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { useCartStore } from '@/store/staffCartStore';
import { usePermission } from '@/utils/permissions';
import { findProductByBarcode } from '@/utils/productCache';
import { addOrIncrementCartItem } from '@/utils/cartOperations';
import { haptics } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

/** Ignore a re-detection of the same code within this window — one physical
 * barcode sitting in frame fires `onBarcodeScanned` many times a second. */
const SCAN_COOLDOWN_MS = 1500;
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

/**
 * Camera barcode scanner for the till, pushed from PosScreen's search bar.
 *
 * A scan resolves through the same offline product cache and the same cart
 * helper a typed search uses (`findProductByBarcode`, `addOrIncrementCartItem`)
 * — Search and Scan are two ways into one cart, not two carts. Stays open
 * across scans (no close-on-success) so a cashier can work through a basket
 * of items; the only thing that pauses detection is an unmatched barcode,
 * which needs a decision before scanning continues.
 */
export function BarcodeScannerScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { toast } = useAlert();
  const user = useAuthStore((s: AuthState) => s.user);
  const canCreateProduct = usePermission('create_product');
  const { cart, addItem, updateItem } = useCartStore();
  const shopId = user?.shop?._id ?? '';

  const [permission, requestPermission] = useCameraPermissions();
  const [unmatchedCode, setUnmatchedCode] = useState<string | null>(null);
  const lastCodeRef = useRef<string | null>(null);
  const lastScanAtRef = useRef(0);

  // The route stays mounted (not unmounted) while another screen sits on top
  // of it — e.g. "Add Product" from the unknown-barcode panel below — so
  // regaining focus is the only signal that we're back. Without this the
  // stale "Barcode not registered" panel for the code that was just added
  // would still be showing, with scanning still paused behind it.
  //
  // Adjusted during render rather than in an effect (React's recommended
  // shape for "reset state when a condition changes") — an effect here would
  // commit the stale panel for one frame before clearing it.
  const [wasFocused, setWasFocused] = useState(isFocused);
  if (isFocused !== wasFocused) {
    setWasFocused(isFocused);
    if (isFocused && unmatchedCode) setUnmatchedCode(null);
  }

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      // A barcode is a string, full stop — trimmed only, never parsed as a
      // number (that would drop meaningful leading zeroes) and never
      // case-folded (an exact match has to stay exact).
      const code = result.data.trim();
      if (!code) return;

      const now = Date.now();
      if (code === lastCodeRef.current && now - lastScanAtRef.current < SCAN_COOLDOWN_MS) return;
      lastCodeRef.current = code;
      lastScanAtRef.current = now;

      const match = findProductByBarcode(shopId, code);
      if (!match) {
        haptics.warning();
        setUnmatchedCode(code);
        return;
      }

      const { product, variant } = match;
      // A configurable product's own barcode (rather than one of its
      // variants') can't say which size/flavour was sold — same rule
      // PosScreen's addToCart applies when a configurable product is tapped.
      if (product.productType === 'configurable' && !variant) {
        toast({ type: 'warning', message: `${product.name} has variants — use Search to pick one.` });
        return;
      }

      const inCart =
        cart.find((i) => i._id === product._id && (i.cartVariantId ?? undefined) === variant?._id)
          ?.cartQuantity ?? 0;
      const stockLimit = variant
        ? variant.quantity
        : product.trackInventory && product.productType !== 'bundle'
          ? product.quantity
          : Infinity;

      if (stockLimit - inCart <= 0) {
        haptics.warning();
        toast({
          type: 'warning',
          message:
            inCart > 0
              ? `All ${stockLimit} of ${product.name} are already in this sale`
              : `${product.name} is out of stock`,
        });
        return;
      }

      addOrIncrementCartItem({ cart, product, quantity: 1, variant, addItem, updateItem });
      haptics.success();
      toast({ type: 'success', message: `✓ ${product.name}${variant ? ` — ${variant.name}` : ''} added` });
    },
    [shopId, cart, addItem, updateItem, toast]
  );

  const scanAgain = () => {
    setUnmatchedCode(null);
    lastCodeRef.current = null;
  };

  const goToAddProduct = () => {
    if (!unmatchedCode) return;
    router.push({
      pathname: user?.role === 'staff' ? '/(staff)/inventory/new' : '/(owner)/inventory/new',
      params: { barcode: unmatchedCode },
    });
  };

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(user?.role === 'staff' ? '/(staff)/dashboard' : '/(owner)/dashboard');
  };

  // ── Permission gates ─────────────────────────────────────────────────
  if (!permission) {
    // Still resolving the current permission state — nothing to render yet.
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    const permanentlyDenied = !permission.canAskAgain;
    return (
      <View style={[styles.container, styles.permissionScreen, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
        <StatusBar style="dark" />
        <View style={styles.permissionIcon}>
          <Ionicons name="camera-outline" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.permissionTitle}>
          {permanentlyDenied ? 'Camera permission is required' : 'Camera access required'}
        </Text>
        <Text style={styles.permissionBody}>
          {permanentlyDenied
            ? 'Turn on camera access in Settings to scan product barcodes.'
            : 'Dukana uses your camera to scan product barcodes.'}
        </Text>
        <AnimatedPressable
          style={styles.permissionPrimaryBtn}
          onPress={permanentlyDenied ? () => Linking.openSettings() : requestPermission}
          accessibilityRole="button"
          accessibilityLabel={permanentlyDenied ? 'Open Settings' : 'Allow Camera'}
        >
          <Text style={styles.permissionPrimaryBtnText}>
            {permanentlyDenied ? 'Open Settings' : 'Allow Camera'}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.permissionSecondaryBtn} onPress={close} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.permissionSecondaryBtnText}>Cancel</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* Released whenever this route loses focus (e.g. pushed through to Add
          Product with the scanner still underneath on the stack), not just on
          unmount — a camera left running behind another screen is a resource
          leak app review will flag, not just a battery-drain nicety. */}
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={unmatchedCode ? undefined : handleScan}
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <AnimatedPressable onPress={close} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Scan barcode</Text>
        <AnimatedPressable onPress={close} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Close scanner">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </AnimatedPressable>
      </View>

      {!unmatchedCode && (
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.instruction}>Align the barcode within the frame</Text>
        </View>
      )}

      {unmatchedCode && (
        <View style={[styles.unknownPanel, { marginBottom: insets.bottom + Spacing.lg }]}>
          <Ionicons name="barcode-outline" size={30} color={Colors.textSecondary} />
          <Text style={styles.unknownTitle}>Barcode not registered</Text>
          <Text style={styles.unknownCode}>{unmatchedCode}</Text>
          <Text style={styles.unknownBody}>This barcode isn&apos;t linked to a product yet.</Text>
          {canCreateProduct && (
            <AnimatedPressable style={styles.unknownPrimaryBtn} onPress={goToAddProduct} accessibilityRole="button" accessibilityLabel="Add Product">
              <Text style={styles.unknownPrimaryBtnText}>Add Product</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable style={styles.unknownSecondaryBtn} onPress={scanAgain} accessibilityRole="button" accessibilityLabel="Scan Again">
            <Text style={styles.unknownSecondaryBtnText}>Scan Again</Text>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );
}

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE * 0.62,
    borderRadius: BorderRadius.lg,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  unknownPanel: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  unknownTitle: {
    fontSize: Typography.size.h3,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  unknownCode: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  unknownBody: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  unknownPrimaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  unknownPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
  unknownSecondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  unknownSecondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
  permissionScreen: {
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    marginTop: 'auto',
  },
  permissionTitle: {
    fontSize: Typography.size.h2,
    fontFamily: Typography.fontFamilyBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  permissionBody: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionPrimaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  permissionPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
  },
  permissionSecondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  permissionSecondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamilySemiBold,
  },
});
