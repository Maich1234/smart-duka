import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAlert } from '@/context/AlertContext';
import { useAuthStore, type AuthState } from '@/store/authStore';
import { useCartStore } from '@/store/staffCartStore';
import { usePermission } from '@/utils/permissions';
import { findProductByBarcode } from '@/utils/productCache';
import { addOrIncrementCartItem } from '@/utils/cartOperations';
import { consumeBarcodeCapture, cancelBarcodeCapture } from '@/utils/barcodeCapture';
import { haptics } from '@/utils/haptics';
import { useScanFeedbackStore } from '@/store/scanFeedbackStore';
import { QuantityModal } from './QuantityModal';
import type { Product, ProductVariant } from '@/services/products';
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

  // Pushed with ?mode=capture from ProductForm's "scan barcode" field button —
  // just returns whatever code the camera reads, no product lookup or cart
  // involved. Everything else about the screen (permission gate, cooldown,
  // header, close button) is shared.
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isCapture = mode === 'capture';

  const [permission, requestPermission] = useCameraPermissions();
  const [unmatchedCode, setUnmatchedCode] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const toggleTorch = useCallback(() => setTorchOn((v) => !v), []);

  // The frame is centered by flexbox, not a fixed coordinate, so its actual
  // screen rect has to come from measuring it rather than being computed —
  // it shifts a few px depending on rendered text height. Drives the four
  // dimming strips below; null until the first layout pass, at which point
  // there's nothing to mask yet anyway.
  const [frameLayout, setFrameLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Scan-recognition feedback — device-local prefs (Settings > Scanning),
  // gated separately from the unrelated warning haptics on an unmatched
  // code or out-of-stock item below, which are error alerts, not "scan
  // feedback," and always fire regardless of these two settings.
  const soundEnabled = useScanFeedbackStore((s) => s.soundEnabled);
  const vibrationEnabled = useScanFeedbackStore((s) => s.vibrationEnabled);
  const beepPlayer = useAudioPlayer(require('@/assets/sounds/scan-beep.wav'));
  // Split out so confirmPendingScan below — which repeats only the haptic
  // half on quantity-modal confirm, since the beep already played when the
  // scan was first recognized — shares this instead of re-checking
  // vibrationEnabled inline and silently drifting from it over time.
  const playScanHaptic = useCallback(() => {
    if (vibrationEnabled) haptics.success();
  }, [vibrationEnabled]);
  const playScanFeedback = useCallback(async () => {
    playScanHaptic();
    if (soundEnabled) {
      // seekTo is async — calling play() before it resolves risks starting
      // from wherever the previous beep's playhead was left, not from 0
      // (noticeable on two scans of an already-in-cart item within ~a second).
      await beepPlayer.seekTo(0);
      beepPlayer.play();
    }
  }, [playScanHaptic, soundEnabled, beepPlayer]);
  // Set when a scan resolves to a product not yet in the cart — the quantity
  // modal needs a decision before scanning continues, same as the unmatched
  // panel. A product already in the cart skips this and increments directly.
  const [pendingScan, setPendingScan] = useState<{ product: Product; variant?: ProductVariant; stockLimit: number } | null>(null);
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

  const close = useCallback(() => {
    // No-op if a capture already fired (consumeBarcodeCapture already
    // cleared it) — only matters when the user backs out via the header
    // button without ever scanning anything, which would otherwise leave a
    // stale callback for the next unrelated capture to accidentally invoke.
    if (isCapture) cancelBarcodeCapture();
    if (router.canGoBack()) router.back();
    else router.replace(user?.role === 'staff' ? '/(staff)/dashboard' : '/(owner)/dashboard');
  }, [user?.role, isCapture]);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      // A barcode is a string, full stop — trimmed only, never parsed as a
      // number (that would drop meaningful leading zeroes) and never
      // case-folded (an exact match has to stay exact).
      const code = result.data.trim();
      if (!code) return;

      const now = Date.now();
      if (code === lastCodeRef.current) {
        if (now - lastScanAtRef.current < SCAN_COOLDOWN_MS) {
          // Still the same barcode, still within the window — refresh the
          // timestamp so continuous dwelling keeps extending the suppression
          // instead of expiring at a fixed point after the *first* sighting.
          // Without this, holding the camera steady over one barcode for
          // longer than SCAN_COOLDOWN_MS silently added it a second time.
          lastScanAtRef.current = now;
          return;
        }
      } else {
        lastCodeRef.current = code;
      }
      lastScanAtRef.current = now;

      if (isCapture) {
        playScanFeedback();
        consumeBarcodeCapture(code);
        close();
        return;
      }

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
        toast({ type: 'warning', message: `${product.name} has variants. Use Search to pick one.` });
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

      if (inCart > 0) {
        // Already on the sale — just bump the line, no modal. A second
        // decision for the same product mid-basket would only slow the
        // cashier down for no benefit.
        addOrIncrementCartItem({ cart, product, quantity: 1, variant, addItem, updateItem });
        playScanFeedback();
        toast({
          type: 'success',
          message: `${product.name}${variant ? `, ${variant.name}` : ''} · Qty ${inCart + 1}`,
        });
        return;
      }

      // First time this product's on the sale — the barcode itself was still
      // successfully recognized, so scan feedback fires now rather than
      // waiting on the quantity modal below (a manual button tap, not a scan
      // event). Ask how many — same modal the manual tap-to-add flow uses.
      // Pauses the camera (see onBarcodeScanned below) until it's answered.
      playScanFeedback();
      setPendingScan({ product, variant, stockLimit });
    },
    [shopId, cart, addItem, updateItem, toast, isCapture, close, playScanFeedback]
  );

  const confirmPendingScan = useCallback(
    (quantity: number) => {
      if (!pendingScan) return;
      const { product, variant } = pendingScan;
      addOrIncrementCartItem({ cart, product, quantity, variant, addItem, updateItem });
      // The beep already played when the scan was first recognized (see the
      // comment above setPendingScan) — only the haptic half of scan feedback
      // repeats here, on confirm, shared via playScanHaptic so it can't drift
      // from the setting the way a second inline check would.
      playScanHaptic();
      toast({ type: 'success', message: `✓ ${product.name}${variant ? `, ${variant.name}` : ''} added` });
      setPendingScan(null);
      // Otherwise the P0-4 dwell guard would block an immediate intentional
      // rescan of the same barcode right after confirming this one.
      lastCodeRef.current = null;
    },
    [pendingScan, cart, addItem, updateItem, toast, playScanHaptic]
  );

  const cancelPendingScan = useCallback(() => {
    setPendingScan(null);
    lastCodeRef.current = null;
  }, []);

  const scanAgain = () => {
    setUnmatchedCode(null);
    lastCodeRef.current = null;
  };

  const goToAddProduct = () => {
    if (!unmatchedCode) return;
    router.push({
      pathname: user?.role === 'staff' ? '/(staff)/inventory/new' : '/(owner)/inventory/new',
      // returnTo=back: come back to the scanner afterwards rather than the
      // Inventory list, which is where this flow lands by default.
      params: { barcode: unmatchedCode, returnTo: 'back' },
    });
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
            : 'DuQana uses your camera to scan product barcodes.'}
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
          enableTorch={torchOn}
          // 'off' is expo-camera's confusing name for continuous autofocus
          // ("automatically focus when needed") — 'on' would instead lock
          // focus after a single shot, which is wrong for a scanner working
          // through a basket of items at different distances. Named
          // explicitly since the default already matches, so a future
          // dependency bump silently flipping it would be easy to miss.
          autofocus="off"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={unmatchedCode || pendingScan ? undefined : handleScan}
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <AnimatedPressable onPress={close} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Scan barcode</Text>
        <View style={styles.headerRight}>
          <AnimatedPressable
            onPress={toggleTorch}
            style={[styles.headerBtn, torchOn && styles.headerBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-off'} size={20} color={torchOn ? '#FBBF24' : '#FFFFFF'} />
          </AnimatedPressable>
          <AnimatedPressable onPress={close} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Close scanner">
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </AnimatedPressable>
        </View>
      </View>

      {!unmatchedCode && (
        <>
          {/* Positioned off `frameLayout`, measured off the frame below — safe
              because frameWrap is the container's only flow child (everything
              else is position:absolute), so it shares the container's origin
              and the frame's onLayout coordinates need no further translation. */}
          {frameLayout && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[styles.maskStrip, { top: 0, left: 0, right: 0, height: frameLayout.y }]} />
              <View
                style={[
                  styles.maskStrip,
                  { top: frameLayout.y + frameLayout.height, left: 0, right: 0, bottom: 0 },
                ]}
              />
              <View
                style={[
                  styles.maskStrip,
                  { top: frameLayout.y, height: frameLayout.height, left: 0, width: frameLayout.x },
                ]}
              />
              <View
                style={[
                  styles.maskStrip,
                  { top: frameLayout.y, height: frameLayout.height, left: frameLayout.x + frameLayout.width, right: 0 },
                ]}
              />
            </View>
          )}
          <View style={styles.frameWrap} pointerEvents="none">
            <View style={styles.frame} onLayout={(e) => setFrameLayout(e.nativeEvent.layout)} />
            <Text style={styles.instruction}>Align the barcode within the frame</Text>
          </View>
        </>
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

      <QuantityModal
        visible={!!pendingScan}
        onClose={cancelPendingScan}
        onConfirm={confirmPendingScan}
        productName={
          pendingScan
            ? `${pendingScan.product.name}${pendingScan.variant ? `, ${pendingScan.variant.name}` : ''}`
            : ''
        }
        maxStock={pendingScan?.stockLimit ?? Infinity}
        unitOfMeasure={pendingScan?.product.unitOfMeasure}
      />
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
  headerBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.25)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
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
  maskStrip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
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
