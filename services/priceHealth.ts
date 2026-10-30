import api from './api';

export interface PriceChange {
  _id: string; actorName: string | null; actor?: string; source: 'created' | 'product_edit' | 'purchase'; createdAt: string;
  changes: { key: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }[];
}
export interface PriceIssue {
  productId: string; name: string; productType: string; unitOfMeasure?: string; variantId?: string; variantName?: string;
  sellingPrice?: number; costPrice?: number | null; stockQuantity: number; stockKnown: boolean; issues: string[];
  unitShortfall: number | null; potentialLoss: number | null; flexible: boolean; minPrice?: number; lastChange: Omit<PriceChange, 'changes'> | null;
}
export interface PriceHealth {
  currency: string; generatedAt: string; digest: string;
  window: { days: number; start: string; end: string };
  summary: { affectedProducts: number; affectedPriceRows: number; zeroPriceRows: number; belowCostRows: number; missingCostRows: number; potentialLoss: number; affectedStockCostValue: number; excludedBundles: number };
  realised: { recordedLoss: number; estimatedLoss: number; unknownCostLines: number; belowCostSaleLines: number; products: { productId?: string; variantId?: string; name: string; variantName?: string; loss: number; quantity: number; estimated: boolean }[] };
  items: PriceIssue[]; pagination: { page: number; limit: number; total: number; pages: number }; notes: string;
}
export const ISSUE_LABELS: Record<string, string> = { zero_or_missing_price: 'Zero, negative or invalid selling price', below_cost: 'Selling price below cost', minimum_below_cost: 'Allowed minimum below cost', cost_not_set: 'Purchase cost needs review', missing_variants: 'No variants configured', invalid_stock_quantity: 'Stock quantity needs correction', invalid_price_range: 'Allowed price range is invalid' };
export async function getPriceHealth(page = 1): Promise<PriceHealth> { return (await api.get('/products/price-health', { params: { page, limit: 20 } })).data.data; }
export async function getPriceHistory(productId: string, page = 1): Promise<{ data: PriceChange[]; pagination: { page: number; pages: number; total: number } }> { return (await api.get(`/products/${encodeURIComponent(productId)}/price-history`, { params: { page } })).data; }

export async function downloadPriceReview(): Promise<void> {
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const { API_BASE_URL } = await import('@/constants/config');
  const { useAuthStore } = await import('@/store/authStore');
  const initial = useAuthStore.getState();
  const token = initial.token;
  const ownerId = initial.user?._id, shopId = initial.user?.shop?._id;
  if (!token || initial.user?.role !== 'owner') throw new Error('Please sign in as the shop owner.');
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
  const destination = new File(Paths.cache, `duqana-price-review-${Date.now()}.pdf`);
  const download = (accessToken: string) => File.downloadFileAsync(`${API_BASE_URL}/products/price-health/pdf`, destination, { headers: { Authorization: `Bearer ${accessToken}` }, idempotent: true });
  let saved;
  try { saved = await download(token); }
  catch (error) {
    if (!/\b401\b/.test(String((error as Error)?.message))) throw error;
    const beforeRefresh = useAuthStore.getState();
    if (beforeRefresh.user?._id !== ownerId || beforeRefresh.user?.shop?._id !== shopId || beforeRefresh.user?.role !== 'owner') throw new Error('Your account changed. Open the report again.');
    const { refreshAuthToken } = await import('@/utils/tokenRefresh');
    const renewed = await refreshAuthToken();
    if (!renewed) throw new Error('Please sign in again.');
    const current = useAuthStore.getState();
    if (current.user?._id !== ownerId || current.user?.shop?._id !== shopId || current.user?.role !== 'owner') throw new Error('Your account changed. Open the report again.');
    saved = await download(renewed);
  }
  const current = useAuthStore.getState();
  if (current.user?._id !== ownerId || current.user?.shop?._id !== shopId || current.user?.role !== 'owner') { if (saved.exists) saved.delete(); throw new Error('Your account changed. Open the report again.'); }
  await Sharing.shareAsync(saved.uri, { mimeType: 'application/pdf', dialogTitle: 'DuQana product price review', UTI: 'com.adobe.pdf' });
}
