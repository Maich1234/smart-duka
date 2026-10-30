import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { usePriceHealth } from '@/hooks/usePriceHealth';
import { downloadPriceReview, getPriceHistory, ISSUE_LABELS, type PriceHealth, type PriceChange } from '@/services/priceHealth';
import { Button } from '@/components/ui/Button';
import { BottomSheet, SheetScrollBody } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';

const money = (n: unknown, currency: string) => typeof n === 'number' && Number.isFinite(n) ? `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Unknown';
const source = (c: PriceChange) => c.source === 'purchase' ? 'Purchase cost recalculation' : c.source === 'created' ? 'Product created' : 'Pricing edited';
function Figures({ data }: { data: PriceHealth }) {
  return <View style={s.figures}>{[
    ['Products to review', String(data.summary.affectedProducts)],
    ['Potential shortfall on remaining stock', money(data.summary.potentialLoss, data.currency)],
    [`Recorded gross shortfall, last ${data.window.days} days`, money(data.realised.recordedLoss, data.currency)],
    ['Stock cost value affected', money(data.summary.affectedStockCostValue, data.currency)],
  ].map(([label, value]) => <View key={label} style={s.figure}><Text style={s.muted}>{label}</Text><Text style={s.value}>{value}</Text></View>)}</View>;
}
export function PriceAlertCard() {
  const { data, isPending, isError, refetch } = usePriceHealth();
  const owner = useAuthStore(state => state.user?.role === 'owner');
  if (!owner) return null;
  if (!data) return <View style={s.card}><Text>{isPending ? 'Checking product prices…' : 'Could not check product prices.'}</Text>{isError && <Button title="Retry price check" onPress={() => { refetch(); }} />}</View>;
  if (!data.summary.affectedPriceRows && !data.realised.belowCostSaleLines && !data.realised.unknownCostLines) return null;
  return <View style={[s.card, s.warning]}><Text style={s.heading}>Product price review</Text><Figures data={data} /><Text style={s.muted}>{data.summary.affectedPriceRows} product/variant alerts. Potential shortfall is not loss already made. Last checked {new Date(data.generatedAt).toLocaleString()}.</Text>{isError && <Text accessibilityRole="alert">Showing the last check. Refresh when connected.</Text>}<Button title="Review products and changes" variant="outline" onPress={() => router.push('/(owner)/price-alerts' as never)} /></View>;
}
export function PriceAlertsScreen() {
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  async function exportPdf() { setExporting(true); setExportError(''); try { await downloadPriceReview(); } catch { setExportError('Could not save or share the PDF. Please retry.'); } finally { setExporting(false); } }

  const [page, setPage] = useState(1), [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<{ id: string; name: string } | null>(null);
  const user = useAuthStore(state => state.user);
  const padding = useTabBarHeight();
  const query = usePriceHealth(page);
  const changes = useQuery({ queryKey: ['productPriceHistory', user?.shop?._id, history?.id, historyPage], queryFn: () => getPriceHistory(history!.id, historyPage), enabled: !!history && user?.role === 'owner' });
  const data = query.data;
  if (user?.role !== 'owner') return <Text>Price review is available to the shop owner.</Text>;
  return <View style={s.screen}><ScreenHeader title="Product price review" fallbackHref="/(owner)/inventory" />
    {!data ? <View style={s.card}>{query.isPending ? <ActivityIndicator color={Colors.primary} /> : <><Text>Could not check product prices.</Text><Button title="Retry" onPress={() => { query.refetch(); }} /></>}</View> : <ScrollView contentContainerStyle={[s.content, { paddingBottom: padding + 24 }]}><Text style={s.muted}>Review entries before changing them. A flexible price, free item or promotion may be intentional.</Text><Button title={exporting ? "Preparing PDF…" : "Save or share verified PDF"} disabled={exporting} onPress={exportPdf} />{!!exportError && <Text accessibilityRole="alert">{exportError}</Text>}<Figures data={data} />{query.isError && <Text accessibilityRole="alert">Showing the last successful check. Refresh when connected.</Text>}<Text style={s.muted}>{data.notes}</Text><Text style={s.muted}>Estimated sales shortfall: {money(data.realised.estimatedLoss, data.currency)}. Unknown-cost sales lines: {data.realised.unknownCostLines}. Bundles excluded from stock totals: {data.summary.excludedBundles}. Costs are saved weighted-average purchase costs.</Text>
      {!data.items.length && <Text>No current price issues found.</Text>}
      {data.items.map(row => <View style={s.card} key={`${row.productId}:${row.variantId ?? 'base'}`}><Text style={s.heading}>{row.name}{row.variantName ? ` · ${row.variantName}` : ''}</Text>{row.issues.map(issue => <Text style={s.issue} key={issue}>{ISSUE_LABELS[issue] ?? issue}</Text>)}<Text>Selling: {money(row.sellingPrice, data.currency)}. Cost: {money(row.costPrice, data.currency)} per {row.unitOfMeasure ?? 'unit'}.</Text><Text>Shortfall per unit: {money(row.unitShortfall, data.currency)}.</Text><Text>{row.productType === 'bundle' ? 'Bundle stock is shared with its components.' : `Positive stock: ${row.stockQuantity}. Potential shortfall: ${money(row.potentialLoss, data.currency)}.`}</Text>{row.flexible && <Text style={s.muted}>Flexible pricing. Allowed minimum: {money(row.minPrice, data.currency)}. Actual sale prices may differ.</Text>}<Text style={s.muted}>{row.lastChange ? `${source(row.lastChange)} by ${row.lastChange.actorName ?? 'name unavailable'} on ${new Date(row.lastChange.createdAt).toLocaleString()}. This does not prove who caused a loss.` : 'History unavailable for prices saved before tracking began.'}</Text><Button title="Review product" variant="outline" onPress={() => router.push(`/(owner)/inventory/${row.productId}/edit` as never)} /><Button title="Price history" variant="ghost" onPress={() => { setHistory({ id: row.productId, name: row.name }); setHistoryPage(1); }} /></View>)}
      <View style={s.paging}><Button title="Previous" disabled={page <= 1} onPress={() => setPage(p => p - 1)} /><Text>Page {page} of {Math.max(1, data.pagination.pages)}</Text><Button title="Next" disabled={page >= data.pagination.pages} onPress={() => setPage(p => p + 1)} /></View><Button title="Refresh price check" variant="outline" onPress={() => { query.refetch(); }} />
      {!!data.realised.products.length && <View style={s.card}><Text style={s.heading}>Largest sales shortfalls in this period</Text><Text style={s.muted}>Up to 10 product/variant groups, including historical prices and discounts.</Text>{data.realised.products.map((p, i) => <Text key={i}>{p.name}{p.variantName ? ` · ${p.variantName}` : ''}: {money(p.loss, data.currency)}{p.estimated ? ' (includes estimates)' : ''}</Text>)}</View>}
    </ScrollView>}
    <BottomSheet visible={!!history} onClose={() => setHistory(null)}><SheetScrollBody><View style={s.content}><Text style={s.heading}>Price history: {history?.name}</Text>{changes.isPending ? <ActivityIndicator color={Colors.primary} /> : changes.isError ? <><Text accessibilityRole="alert">Could not load history.</Text><Button title="Retry history" onPress={() => { changes.refetch(); }} /></> : <>{!changes.data?.data.length && <Text>No recorded changes. Older prices cannot be attributed retrospectively.</Text>}{changes.data?.data.map(change => <View style={s.card} key={change._id}><Text style={s.heading}>{source(change)} · {change.actorName ?? 'Name unavailable'}</Text><Text style={s.muted}>{new Date(change.createdAt).toLocaleString()}</Text>{change.changes.map((c, i) => <View key={i}><Text>{String(c.after?.name ?? c.before?.name ?? (c.key === 'base' ? 'Product' : 'Variant'))}</Text><Text>Selling: {money(c.before?.sellingPrice, data?.currency ?? 'KES')} → {money(c.after?.sellingPrice, data?.currency ?? 'KES')}</Text><Text>Cost: {money(c.before?.costPrice, data?.currency ?? 'KES')} → {money(c.after?.costPrice, data?.currency ?? 'KES')}</Text><Text style={s.muted}>Minimum: {money(c.before?.minPrice, data?.currency ?? 'KES')} → {money(c.after?.minPrice, data?.currency ?? 'KES')}. Pricing setup changes are retained in this record.</Text></View>)}</View>)}<View style={s.paging}><Button title="Previous" disabled={historyPage <= 1} onPress={() => setHistoryPage(p => p - 1)} /><Text>Page {historyPage}</Text><Button title="Next" disabled={historyPage >= (changes.data?.pagination.pages ?? 1)} onPress={() => setHistoryPage(p => p + 1)} /></View></>}</View></SheetScrollBody></BottomSheet>
  </View>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: Colors.background }, content: { padding: 16, gap: 16 }, card: { marginVertical: 6, padding: 16, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface, gap: 10 }, warning: { borderColor: '#D6B457', backgroundColor: '#FFFBEB' }, heading: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary }, muted: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary }, issue: { color: '#92400E', fontSize: 14 }, figures: { gap: 10 }, figure: { gap: 3, paddingVertical: 6 }, value: { fontSize: 21, fontWeight: '700', color: Colors.textPrimary }, paging: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 } });
