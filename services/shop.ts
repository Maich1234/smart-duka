import api from './api';

export interface Shop {
  _id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  country: string;
  currency: string;
  isActive: boolean;
  receiptThankYouNote?: string;
  logoUrl?: string;
  motto?: string;
  /** Owner feature flag: staff must clock in before selling. */
  shiftManagementEnabled?: boolean;
  /** Owner feature flag: staff can preview commission while selling and view their own earnings. */
  showStaffCommission?: boolean;
  /** ISO timestamp — earliest possible date for any sale, used as a
   * lower bound on sales date-range pickers. */
  createdAt?: string;
}

export interface ShopConfigResponse {
  success: boolean;
  data: Shop;
}

export interface UpdateShopConfigData {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRate?: number;
  country?: string;
  currency?: string;
  receiptThankYouNote?: string;
  logoUrl?: string;
  motto?: string;
  shiftManagementEnabled?: boolean;
  showStaffCommission?: boolean;
}

export const getShopConfig = async (): Promise<ShopConfigResponse> => {
  const res = await api.get('/shop');
  return res.data;
};

export const updateShopConfig = async (data: UpdateShopConfigData): Promise<ShopConfigResponse> => {
  const res = await api.put('/shop', data);
  return res.data;
};

export const uploadShopLogo = async (uri: string, mimeType: string): Promise<{ logoUrl: string }> => {
  const form = new FormData();
  form.append('logo', { uri, name: 'logo.jpg', type: mimeType } as any);
  const res = await api.post('/shop/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
};
