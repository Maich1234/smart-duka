import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, type TextProps } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { usePriceHealth } from '@/hooks/usePriceHealth';
import { downloadPriceReview, getPriceHistory, ISSUE_LABELS, type PriceHealth, type PriceChange, type PriceIssue } from '@/services/priceHealth';
import { Button } from '@/components/ui/Button';
import { BottomSheet, SheetScrollBody } from '@/components/ui/BottomSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';

const money = (n: unknown, currency: string) => typeof n === 'number' && Number.isFinite(n) ? `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Unknown';
const source = (change: Pick<PriceChange, 'source'>) => change.source === 'purchase' ? 'Purchase cost updated' : change.source === 'created' ? 'Product created' : 'Price edited';
const checkedAt = (date: string) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const hasIssues = (data: PriceHealth) => !!(data.summary.affectedPriceRows || data.realised.belowCostSaleLines || data.realised.unknownCostLines);
function Copy({ style, ...props }: TextProps) { return <Text {...props} style={[s.body, style]} />; }
function title(data: PriceHealth) {
  const count = data.summary.affectedProducts;
  return count ? `${count} ${count === 1 ? 'product needs' : 'products need'} a price review` : 'Review costs on past sales';
}
function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <View style={s.metric}><Copy style={s.muted}>{label}</Copy><Copy style={[s.metricValue, accent && s.riskText]}>{value}</Copy></View>;
}
function Figures({ data }: { data: PriceHealth }) {
  return <View style={s.figures}>
    <Metric label="Products to review" value={String(data.summary.affectedProducts)} />
    <Metric label="Potential stock shortfall" value={money(data.summary.potentialLoss, data.currency)} accent={data.summary.potentialLoss > 0} />
    <Metric label={`Recorded shortfall · ${data.window.days} days`} value={money(data.realised.recordedLoss, data.currency)} />
    <Metric label="Affected stock at cost" value={money(data.summary.affectedStockCostValue, data.currency)} />
  </View>;
}

/** Compact summary only. Full figures and definitions belong on the review screen. */
export function PriceAlertCard({ inset = false }: { inset?: boolean }) {
  const { data, isPending, isError, isFetching, refetch } = usePriceHealth();
  const owner = useAuthStore(state => state.user?.role === 'owner');
  if (!owner || (data && !hasIssues(data) && !isError)) return null;
  return <View style={[s.summary, inset && s.inset]}>
    <View style={s.row}>
      <View style={s.iconChip}><Ionicons name={isError ? 'cloud-offline-outline' : 'pricetag-outline'} size={20} color={Colors.warningDark} /></View>
      <View style={s.grow}><Copy style={s.heading}>{data && hasIssues(data) ? title(data) : isPending ? 'Checking product prices' : 'Price check unavailable'}</Copy>
        <Copy style={s.muted}>{data && hasIssues(data) ? 'Check selling prices and purchase costs.' : isPending ? 'Looking for missing prices and prices below cost.' : 'We could not refresh your product prices.'}</Copy></View>
      {!data && isPending && <ActivityIndicator color={Colors.primary} />}
    </View>
    {data && hasIssues(data) && data.summary.potentialLoss > 0 && <View style={s.summaryAmount}>
      <Copy style={s.muted}>Potential stock shortfall</Copy><Copy style={s.summaryValue}>{money(data.summary.potentialLoss, data.currency)}</Copy>
    </View>}
    {data && hasIssues(data) && data.summary.potentialLoss > 0 && <Copy style={s.caption}>At current prices. This is not a loss already made.</Copy>}
    {isError && data && <Copy accessibilityRole="alert" style={s.riskText}>Showing the last check. Prices may have changed.</Copy>}
    <View style={s.summaryFooter}>
      <Copy style={s.caption}>{data ? `Checked ${checkedAt(data.generatedAt)}` : 'Product price checks'}</Copy>
      {isError ? <Button title="Retry check" size="sm" variant="ghost" loading={isFetching} onPress={() => { refetch(); }} /> : data && <Pressable accessibilityRole="button" accessibilityLabel="Review product prices" onPress={() => router.push('/(owner)/price-alerts' as never)} style={({ pressed }) => [s.textAction, pressed && s.pressed]}><Copy style={s.link}>Review prices</Copy><Ionicons name="arrow-forward" size={17} color={Colors.primary} /></Pressable>}
    </View>
  </View>;
}

function ProductRow({ row, currency, onHistory }: { row: PriceIssue; currency: string; onHistory: () => void }) {
  return <View style={s.product}>
    <View style={s.row}><View style={s.grow}><Copy style={s.heading}>{row.name}</Copy><Copy style={s.caption}>{row.variantName ?? row.productType} · per {row.unitOfMeasure ?? 'unit'}</Copy></View></View>
    <View style={s.badges}>{row.issues.map(issue => <View key={issue} style={s.badge}><Copy style={s.badgeText}>{ISSUE_LABELS[issue] ?? issue}</Copy></View>)}</View>
    <View style={s.priceComparison}><View style={s.priceColumn}><Copy style={s.muted}>Selling price</Copy><Copy style={[s.priceValue, row.issues.includes('below_cost') && s.riskText]}>{money(row.sellingPrice, currency)}</Copy></View><View style={s.priceColumn}><Copy style={s.muted}>Purchase cost</Copy><Copy style={s.priceValue}>{money(row.costPrice, currency)}</Copy></View></View>
    <View style={s.productFacts}>
      <Copy style={s.muted}>Shortfall per unit <Copy style={s.strong}>{money(row.unitShortfall, currency)}</Copy></Copy>
      <Copy style={s.muted}>{row.stockKnown === false ? 'Invalid stock quantity. Excluded from stock estimates.' : row.productType === 'bundle' ? 'Stock is shared with its component products.' : `${row.stockQuantity} in stock · Potential shortfall ${money(row.potentialLoss, currency)}`}</Copy>
      {row.flexible && <Copy style={s.muted}>Flexible price · Minimum {money(row.minPrice, currency)}. Actual sale prices may differ.</Copy>}
    </View>
    <Copy style={s.caption}>{row.lastChange ? `${source(row.lastChange)} by ${row.lastChange.actorName ?? 'name unavailable'} · ${new Date(row.lastChange.createdAt).toLocaleDateString()}` : 'No price history recorded before tracking began.'}</Copy>
    <View style={s.productActions}><View style={s.grow}><Button title="Review product" size="sm" variant="outline" onPress={() => router.push(`/(owner)/inventory/${row.productId}/edit` as never)} /></View><View style={s.grow}><Button title="Price history" size="sm" variant="ghost" onPress={onHistory} /></View></View>
  </View>;
}

export function PriceAlertsScreen() {
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [explanation, setExplanation] = useState(false);
  const [page, setPage] = useState(1), [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<{ id: string; name: string } | null>(null);
  const user = useAuthStore(state => state.user);
  const padding = useTabBarHeight();
  const query = usePriceHealth(page);
  const changes = useQuery({ queryKey: ['productPriceHistory', user?.shop?._id, history?.id, historyPage], queryFn: () => getPriceHistory(history!.id, historyPage), enabled: !!history && user?.role === 'owner' });
  const data = query.data;
  async function exportPdf() {
    if (exporting) return;
    setExporting(true); setExportError(''); setExportNotice('');
    try { await downloadPriceReview(); setExportNotice('PDF prepared with a verification QR code.'); }
    catch (error) { setExportError(error instanceof Error && error.message === 'Please sign in again.' ? 'Your session has expired. Sign in again before exporting the PDF.' : 'Could not save or share the PDF. Check your connection and try again.'); }
    finally { setExporting(false); }
  }
  if (user?.role !== 'owner') return <Copy>Price review is available to the shop owner.</Copy>;
  return <View style={s.screen}><ScreenHeader title="Price review" fallbackHref="/(owner)/inventory" />
    {!data ? <View style={s.empty}><Ionicons name={query.isPending ? 'pricetag-outline' : 'cloud-offline-outline'} size={30} color={Colors.primary} /><Copy style={s.heading}>{query.isPending ? 'Checking your product prices' : 'Could not load price review'}</Copy><Copy style={s.muted}>{query.isPending ? 'Looking for prices that need your attention.' : 'Check your connection and try again.'}</Copy>{query.isPending ? <ActivityIndicator color={Colors.primary} /> : <Button title="Retry price check" loading={query.isFetching} onPress={() => { query.refetch(); }} />}</View> : <ScrollView contentContainerStyle={[s.content, { paddingBottom: padding + 24 }]} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { query.refetch(); }} tintColor={Colors.primary} />}>
      <View style={s.intro}><View style={s.row}><View style={s.grow}><Copy style={s.eyebrow}>PRODUCT PRICES</Copy><Copy style={s.title}>{hasIssues(data) ? 'A closer look at your prices' : 'Your prices look good'}</Copy></View><View style={[s.iconChip, !hasIssues(data) && s.successChip]}><Ionicons name={hasIssues(data) ? 'pricetag-outline' : 'checkmark-circle-outline'} size={24} color={hasIssues(data) ? Colors.warningDark : Colors.success} /></View></View><Copy style={s.muted}>Review each entry before changing it. Free items and promotional prices may be intentional.</Copy><Copy style={s.caption}>Last checked {new Date(data.generatedAt).toLocaleString()}</Copy></View>
      {query.isError && <View style={s.notice}><Copy accessibilityRole="alert" style={s.body}>Could not refresh. These are the last available figures.</Copy><Button title="Retry refresh" variant="ghost" size="sm" loading={query.isFetching} onPress={() => { query.refetch(); }} /></View>}
      <Figures data={data} />
      <View style={s.toolbar}><Pressable style={s.textAction} accessibilityRole="button" accessibilityState={{ expanded: explanation }} onPress={() => setExplanation(v => !v)}><Ionicons name="information-circle-outline" size={18} color={Colors.primary} /><Copy style={s.link}>About these figures</Copy><Ionicons name={explanation ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} /></Pressable><Button title={exporting ? "Preparing PDF…" : "Export PDF"} size="sm" variant="outline" leftIcon="download-outline" loading={exporting} onPress={exportPdf} /></View>
      {!!exportError && <Copy accessibilityRole="alert" style={s.error}>{exportError}</Copy>}
      {!!exportNotice && <Copy accessibilityLiveRegion="polite" style={s.link}>{exportNotice}</Copy>}
      {explanation && <View style={s.explanation}><Copy style={s.heading}>How to read this review</Copy><Copy style={s.muted}>{data.notes}</Copy><Copy style={s.muted}>Estimated sales shortfall: {money(data.realised.estimatedLoss, data.currency)}. Sales lines with unknown costs: {data.realised.unknownCostLines}. Bundles excluded from stock totals: {data.summary.excludedBundles}.</Copy><Copy style={s.muted}>Purchase costs are saved weighted averages. The last recorded editor is not proof of who caused a shortfall.</Copy></View>}
      <View style={s.sectionHeading}><Copy style={s.heading}>Products to review</Copy><Copy style={s.caption}>{data.pagination.total} {data.pagination.total === 1 ? 'entry' : 'entries'}</Copy></View>
      {!data.items.length && <View style={s.empty}><Ionicons name={data.pagination.total > 0 ? 'layers-outline' : 'checkmark-circle-outline'} size={28} color={Colors.primary} /><Copy style={s.heading}>{data.pagination.total > 0 ? 'No entries on this page' : 'No current price issues'}</Copy><Copy style={s.muted}>{data.pagination.total > 0 ? 'Return to the first page to see the remaining entries.' : 'Past sales may still show a shortfall below.'}</Copy>{data.pagination.total > 0 && <Button title="Back to first page" size="sm" onPress={() => setPage(1)} />}</View>}
      {data.items.map(row => <ProductRow key={`${row.productId}:${row.variantId ?? 'base'}`} row={row} currency={data.currency} onHistory={() => { setHistory({ id: row.productId, name: row.name }); setHistoryPage(1); }} />)}
      {data.pagination.pages > 1 && <View style={s.paging}><Button title="Previous" size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage(p => p - 1)} /><Copy style={s.caption}>Page {page} of {Math.max(page, data.pagination.pages)}</Copy><Button title="Next" size="sm" variant="outline" disabled={page >= data.pagination.pages} onPress={() => setPage(p => p + 1)} /></View>}
      {!!data.realised.products.length && <View style={s.explanation}><Copy style={s.heading}>Past sales below cost</Copy><Copy style={s.muted}>Largest shortfalls in the last {data.window.days} days, including historical prices and discounts. Up to 10 product or variant groups.</Copy>{data.realised.products.map((product, i) => <View style={s.historyRow} key={i}><Copy style={s.grow}>{product.name}{product.variantName ? ` · ${product.variantName}` : ''}{product.estimated ? ' (includes estimates)' : ''}</Copy><Copy style={s.strong}>{money(product.loss, data.currency)}</Copy></View>)}</View>}
    </ScrollView>}
    <BottomSheet visible={!!history} onClose={() => setHistory(null)} footer={<Button title="Done" variant="outline" onPress={() => setHistory(null)} />}><SheetScrollBody><View style={s.content}><Copy style={s.title}>Price history</Copy><Copy style={s.muted}>{history?.name}</Copy><Copy style={s.caption}>Changes show the last recorded editor, not who caused a loss.</Copy>
      {changes.isPending ? <ActivityIndicator color={Colors.primary} /> : changes.isError ? <View style={s.empty}><Copy accessibilityRole="alert">Could not load price history.</Copy><Button title="Retry history" loading={changes.isFetching} onPress={() => { changes.refetch(); }} /></View> : <>
        {!changes.data?.data.length && <Copy style={s.muted}>No recorded changes. Older prices cannot be attributed retrospectively.</Copy>}
        {changes.data?.data.map(change => <View style={s.product} key={change._id}><Copy style={s.heading}>{source(change)}</Copy><Copy style={s.muted}>{change.actorName ?? 'Name unavailable'} · {new Date(change.createdAt).toLocaleString()}</Copy>{change.changes.map((c, i) => <View style={s.productFacts} key={i}><Copy style={s.strong}>{String(c.after?.name ?? c.before?.name ?? (c.key === 'base' ? 'Product' : 'Variant'))}</Copy><Copy>Selling: {money(c.before?.sellingPrice, data?.currency ?? 'KES')} → {money(c.after?.sellingPrice, data?.currency ?? 'KES')}</Copy><Copy>Cost: {money(c.before?.costPrice, data?.currency ?? 'KES')} → {money(c.after?.costPrice, data?.currency ?? 'KES')}</Copy><Copy>Unit: {String(c.before?.unitOfMeasure ?? 'Not recorded')} → {String(c.after?.unitOfMeasure ?? 'Not recorded')}</Copy><Copy style={s.caption}>Minimum: {money(c.before?.minPrice, data?.currency ?? 'KES')} → {money(c.after?.minPrice, data?.currency ?? 'KES')}</Copy></View>)}</View>)}
        {(changes.data?.pagination.pages ?? 0) > 1 && <View style={s.paging}><Button title="Previous" size="sm" variant="outline" disabled={historyPage <= 1} onPress={() => setHistoryPage(p => p - 1)} /><Copy style={s.caption}>Page {historyPage}</Copy><Button title="Next" size="sm" variant="outline" disabled={historyPage >= (changes.data?.pagination.pages ?? 1)} onPress={() => setHistoryPage(p => p + 1)} /></View>}
      </>}
    </View></SheetScrollBody></BottomSheet>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  body: { fontFamily: Typography.fontFamily, fontSize: 14, lineHeight: 21, color: Colors.textPrimary },
  strong: { fontFamily: Typography.fontFamilySemiBold, color: Colors.textPrimary },
  heading: { fontFamily: Typography.fontFamilySemiBold, fontSize: 16, lineHeight: 23, color: Colors.textPrimary },
  title: { fontFamily: Typography.fontFamilyBold, fontSize: 23, lineHeight: 30, color: Colors.textPrimary },
  muted: { fontSize: 13, lineHeight: 20, color: Colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  eyebrow: { fontFamily: Typography.fontFamilySemiBold, fontSize: 11, lineHeight: 18, letterSpacing: 1, color: Colors.primary, marginBottom: 4 },
  content: { padding: 16, gap: 16 }, grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16, backgroundColor: Colors.surface, gap: 10, marginBottom: 16 },
  inset: { marginHorizontal: 16 },
  iconChip: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.accentSubtle, justifyContent: 'center', alignItems: 'center' },
  successChip: { backgroundColor: Colors.successSubtle },
  summaryAmount: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  summaryValue: { fontFamily: Typography.fontFamilyBold, fontSize: 20, lineHeight: 28, color: Colors.warningDark, fontVariant: ['tabular-nums'] },
  summaryFooter: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
  link: { fontFamily: Typography.fontFamilySemiBold, color: Colors.primary, fontSize: 13 },
  pressed: { opacity: 0.65 },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: '47%', minWidth: 120, padding: 14, gap: 8, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14 },
  metricValue: { fontFamily: Typography.fontFamilyBold, fontSize: 21, lineHeight: 29, fontVariant: ['tabular-nums'] },
  riskText: { color: Colors.warningDark },
  intro: { gap: 10 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  explanation: { padding: 16, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  product: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { backgroundColor: Colors.accentSubtle, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, maxWidth: '100%' },
  badgeText: { fontSize: 12, lineHeight: 18, fontFamily: Typography.fontFamilySemiBold, color: Colors.warningDark },
  priceComparison: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.divider },
  priceColumn: { flexGrow: 1, flexBasis: '42%', gap: 4, minWidth: 100 },
  priceValue: { fontFamily: Typography.fontFamilySemiBold, fontSize: 18, lineHeight: 26, fontVariant: ['tabular-nums'] },
  productFacts: { gap: 6 }, productActions: { flexDirection: 'row', gap: 8 },
  paging: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.divider },
  empty: { padding: 24, backgroundColor: Colors.surface, borderRadius: 16, alignItems: 'center', gap: 12 },
  notice: { backgroundColor: Colors.accentSubtle, borderRadius: 12, padding: 12, gap: 4 },
  error: { color: Colors.danger },
});
