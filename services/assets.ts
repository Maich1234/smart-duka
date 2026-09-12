import api from './api';

/**
 * Business assets — things the shop owns and uses to trade.
 *
 * Writes go through the shared axios instance, so they inherit the offline
 * outbox and its idempotency key for free: recording a fridge with no signal
 * queues to SQLite and replays once, not twice, when the connection returns.
 *
 * There is no delete. Removal is `updateAsset(id, { archived: true })`, which
 * hides the row and drops it out of the capital total while keeping the record.
 */

export type AssetCategory =
  | 'equipment' | 'furniture' | 'electronics'
  | 'refrigeration' | 'fixtures' | 'transport' | 'other';

export type AssetStatus = 'active' | 'in_repair' | 'disposed';

export interface Asset {
  _id: string;
  shop: string;
  name: string;
  category: AssetCategory;
  /** What one unit cost. */
  acquisitionValue: number;
  /** The owner's estimate of one unit's worth today; null when not estimated. */
  currentValue: number | null;
  acquisitionDate: string;
  quantity: number;
  serialNumber?: string;
  notes?: string;
  imageUrl?: string;
  status: AssetStatus;
  archivedAt: string | null;
  /** quantity × (currentValue ?? acquisitionValue) — computed server-side. */
  estimatedValue: number;
  /** Which of the two numbers `estimatedValue` came from. */
  valueBasis: 'current' | 'acquisition';
  createdAt: string;
  updatedAt: string;
}

export interface AssetsResponse {
  success: boolean;
  data: Asset[];
  summary: { liveCount: number };
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface CreateAssetData {
  name: string;
  category?: AssetCategory;
  acquisitionValue: number;
  currentValue?: number | null;
  acquisitionDate?: string;
  quantity?: number;
  serialNumber?: string;
  notes?: string;
  status?: AssetStatus;
}

export type UpdateAssetData = Partial<CreateAssetData> & { archived?: boolean };

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  equipment: 'Equipment',
  furniture: 'Furniture',
  electronics: 'Electronics',
  refrigeration: 'Refrigeration',
  fixtures: 'Fixtures',
  transport: 'Transport',
  other: 'Other',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'In use',
  in_repair: 'In repair',
  disposed: 'Sold or scrapped',
};

export const getAssets = async (params?: {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}): Promise<AssetsResponse> => {
  const response = await api.get('/assets', { params });
  return response.data;
};

export const createAsset = async (data: CreateAssetData): Promise<{ success: boolean; data: Asset }> => {
  const response = await api.post('/assets', data);
  return response.data;
};

export const updateAsset = async (
  id: string,
  data: UpdateAssetData,
): Promise<{ success: boolean; data: Asset }> => {
  const response = await api.put(`/assets/${id}`, data);
  return response.data;
};
