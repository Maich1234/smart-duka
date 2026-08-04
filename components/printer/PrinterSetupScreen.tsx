import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useAlert } from '@/context/AlertContext';
import { getShopConfig } from '@/services/shop';
import { usePrinterStore } from '@/store/printerStore';
import {
  availableTransports,
  disconnectPrinter,
  ensurePrinterPermissions,
  isBluetoothOn,
  listPairedPrinters,
  scanForPrinters,
} from '@/utils/bluetoothPrinter';
import type { PaperWidth } from '@/utils/escpos';
import { printTestPage } from '@/utils/printSale';
import { printerErrorMessage, type DiscoveredPrinter } from '@/utils/printerTypes';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { BorderRadius } from '@/constants/BorderRadius';

const PAPER_WIDTHS: { value: PaperWidth; label: string; hint: string }[] = [
  { value: 58, label: '58mm', hint: 'Standard duka roll' },
  { value: 80, label: '80mm', hint: 'Wide receipt roll' },
];

/**
 * Bluetooth printer setup, shared by the owner and staff Profile tabs.
 *
 * Receipts have always gone through the OS print sheet (expo-print), which only
 * reaches printers Android/iOS already know about — never the Bluetooth thermal
 * printer sitting on the counter. This screen pairs one directly, and the sale
 * receipt then prints in one tap with no system dialog at all.
 */
export const PrinterSetupScreen: React.FC = () => {
  const tabBarHeight = useTabBarHeight();
  const { toast, alert } = useAlert();
  const { printer, savePrinter, setPaperWidth, forgetPrinter } = usePrinterStore();

  const [transports] = useState(() => availableTransports());
  const [bluetoothOn, setBluetoothOn] = useState(true);
  const [paired, setPaired] = useState<DiscoveredPrinter[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const stopScanRef = useRef<(() => void) | null>(null);

  const supported = transports.length > 0;

  const { data: shopConfig } = useQuery({ queryKey: ['shopConfig'], queryFn: getShopConfig });
  const shopName = shopConfig?.data.name ?? 'Dukana';

  /**
   * Reads the adapter state and the already-bonded devices. Kept off the render
   * path (never called straight from an effect body) so it can also re-run when
   * the user turns Bluetooth on and taps Scan.
   */
  const loadPairedDevices = async (signal?: { cancelled: boolean }) => {
    if (!supported) return;
    try {
      const on = await isBluetoothOn();
      if (signal?.cancelled) return;
      setBluetoothOn(on);
      // getPairedDevices needs an enabled adapter; asking while off just throws.
      if (!on) return;

      const devices = await listPairedPrinters();
      if (signal?.cancelled) return;
      setPaired(devices);
    } catch (error) {
      if (!signal?.cancelled) toast({ type: 'error', message: printerErrorMessage(error) });
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    void (async () => {
      await loadPairedDevices(signal);
    })();
    return () => {
      signal.cancelled = true;
    };
    // Runs once on mount; the Scan action refreshes it afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An abandoned scan keeps the radio busy and blocks the next connect attempt.
  useEffect(() => () => stopScanRef.current?.(), []);

  const handleScan = async () => {
    if (scanning) {
      stopScanRef.current?.();
      stopScanRef.current = null;
      setScanning(false);
      return;
    }

    if (!(await ensurePrinterPermissions())) {
      alert({
        type: 'warning',
        title: 'Bluetooth permission needed',
        message: 'Dukana needs Bluetooth access to find your printer. Allow it in Settings, then try again.',
        buttons: [
          { label: 'Not now', variant: 'ghost' },
          { label: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      });
      return;
    }

    if (!(await isBluetoothOn())) {
      setBluetoothOn(false);
      toast({ type: 'warning', message: 'Turn on Bluetooth, then scan again' });
      return;
    }

    setBluetoothOn(true);
    // Bluetooth may have been off at mount, leaving the paired list empty.
    await loadPairedDevices();
    setDiscovered([]);
    setScanning(true);
    try {
      stopScanRef.current = await scanForPrinters(
        (found) => setDiscovered((current) => [...current, found]),
        () => {
          setScanning(false);
          stopScanRef.current = null;
        }
      );
    } catch (error) {
      setScanning(false);
      toast({ type: 'error', message: printerErrorMessage(error) });
    }
  };

  const handleSelect = (device: DiscoveredPrinter) => {
    stopScanRef.current?.();
    stopScanRef.current = null;
    setScanning(false);
    savePrinter(device, printer?.paperWidth ?? 58);
    toast({ type: 'success', message: `${device.name} saved — receipts now print here` });
  };

  const handleTestPrint = async () => {
    if (!printer) return;
    setTesting(true);
    try {
      await printTestPage(printer, shopName);
      toast({ type: 'success', message: 'Test receipt sent to the printer' });
    } catch (error) {
      toast({ type: 'error', message: printerErrorMessage(error) });
    } finally {
      setTesting(false);
    }
  };

  const handleForget = () => {
    alert({
      type: 'confirm',
      title: 'Forget this printer?',
      message: 'Receipts will go back to the normal system print sheet until you pick a printer again.',
      buttons: [
        { label: 'Cancel', variant: 'ghost' },
        {
          label: 'Forget',
          variant: 'danger',
          onPress: () => {
            // Drop the open socket too, or the printer stays claimed by the app
            // until the process dies and no other till can connect to it.
            void disconnectPrinter();
            forgetPrinter();
            toast({ type: 'info', message: 'Printer removed' });
          },
        },
      ],
    });
  };

  // Already-saved printer is shown in its own card above, not repeated in the lists.
  const listed = [...paired, ...discovered.filter((d) => !paired.some((p) => p.id === d.id))].filter(
    (device) => device.id !== printer?.id
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + Spacing.lg }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>
        Connect the thermal printer on your counter and receipts print straight to it — no system print dialog.
        Without one, printing keeps using your phone&apos;s built-in print sheet.
      </Text>

      {!supported && (
        <View style={[styles.banner, styles.bannerNeutral]}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.bannerText}>
            {Platform.OS === 'ios'
              ? 'iPhones can only reach Bluetooth LE printers, and none was detected. Receipts will print through the system print sheet.'
              : 'Bluetooth printing is not available on this device. Receipts will print through the system print sheet.'}
          </Text>
        </View>
      )}

      {supported && !bluetoothOn && (
        <View style={[styles.banner, styles.bannerWarning]}>
          <Ionicons name="bluetooth-outline" size={16} color="#B45309" />
          <Text style={[styles.bannerText, styles.bannerTextWarning]}>
            Bluetooth is switched off. Turn it on to find your printer.
          </Text>
        </View>
      )}

      {printer && (
        <Animated.View entering={FadeInUp.duration(320)} style={styles.savedCard}>
          <View style={styles.savedHeader}>
            <View style={styles.savedIcon}>
              <Ionicons name="print" size={20} color={Colors.primary} />
            </View>
            <View style={styles.savedText}>
              <Text style={styles.savedName} numberOfLines={1}>{printer.name}</Text>
              <Text style={styles.savedMeta}>
                {printer.transport === 'ble' ? 'Bluetooth LE' : 'Bluetooth'} · {printer.paperWidth}mm paper
              </Text>
            </View>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>ACTIVE</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>PAPER WIDTH</Text>
          <View style={styles.segmented}>
            {PAPER_WIDTHS.map((option) => {
              const selected = printer.paperWidth === option.value;
              return (
                <AnimatedPressable
                  key={option.value}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => setPaperWidth(option.value)}
                  // A radio role here would silently never fire on web (RNGH).
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label} paper, ${option.hint}`}
                >
                  <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
                  <Text style={[styles.segmentHint, selected && styles.segmentHintSelected]}>{option.hint}</Text>
                </AnimatedPressable>
              );
            })}
          </View>

          <Button
            title="Print test receipt"
            variant="outline"
            leftIcon="document-text-outline"
            loading={testing}
            onPress={handleTestPrint}
            style={styles.testBtn}
          />
          <Button title="Forget this printer" variant="ghost" onPress={handleForget} />
        </Animated.View>
      )}

      {supported && (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>{printer ? 'OTHER PRINTERS' : 'AVAILABLE PRINTERS'}</Text>
            {scanning && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          <View style={styles.list}>
            {listed.map((device, index) => (
              <AnimatedPressable
                key={`${device.transport}-${device.id}`}
                style={[styles.row, index > 0 && styles.rowDivided]}
                onPress={() => handleSelect(device)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${device.name} as the receipt printer`}
              >
                <Ionicons
                  name={device.transport === 'ble' ? 'bluetooth-outline' : 'print-outline'}
                  size={18}
                  color={Colors.textSecondary}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>{device.name}</Text>
                  <Text style={styles.rowMeta}>
                    {device.paired ? 'Paired' : 'Nearby'} · {device.transport === 'ble' ? 'Bluetooth LE' : 'Bluetooth'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </AnimatedPressable>
            ))}

            {listed.length === 0 && (
              <Text style={styles.emptyText}>
                {scanning ? 'Looking for printers nearby…' : 'No printers found yet. Switch the printer on and scan.'}
              </Text>
            )}
          </View>

          <Button
            title={scanning ? 'Stop scanning' : 'Scan for printers'}
            variant={scanning ? 'outline' : 'primary'}
            leftIcon={scanning ? 'stop-circle-outline' : 'search-outline'}
            onPress={handleScan}
            style={styles.scanBtn}
          />

          {Platform.OS === 'android' && (
            <Text style={styles.hint}>
              Most thermal printers must be paired once in your phone&apos;s Bluetooth settings (PIN is usually 0000 or
              1234). Paired printers show up here automatically.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  intro: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerNeutral: { backgroundColor: Colors.divider },
  bannerWarning: { backgroundColor: Colors.warningSubtle },
  bannerText: {
    flex: 1,
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  bannerTextWarning: { color: '#B45309' },
  savedCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primarySubtle,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  savedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  savedIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: { flex: 1 },
  savedName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textPrimary,
  },
  savedMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: Colors.successSubtle,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  activePillText: {
    fontSize: 9,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.success,
    letterSpacing: 0.8,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  segmented: { flexDirection: 'row', gap: Spacing.sm },
  segment: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  segmentSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  segmentLabel: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textSecondary,
  },
  segmentLabelSelected: { color: Colors.primaryDark },
  segmentHint: {
    fontSize: 10,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  segmentHintSelected: { color: Colors.primary },
  testBtn: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    color: Colors.textTertiary,
    letterSpacing: 1.2,
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowText: { flex: 1 },
  rowName: {
    fontSize: Typography.size.body,
    fontFamily: Typography.fontFamily,
    color: Colors.textPrimary,
  },
  rowMeta: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: Typography.size.small,
    fontFamily: Typography.fontFamily,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  scanBtn: { marginTop: Spacing.md },
  hint: {
    fontSize: Typography.size.caption,
    fontFamily: Typography.fontFamily,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: Spacing.md,
  },
});
