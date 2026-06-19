import api from './api';

export interface Shop {
  _id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  isActive: boolean;
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
  currency?: string;
}

export const getShopConfig = async (): Promise<ShopConfigResponse> => {
  const res = await api.get('/shop');
  return res.data;
};

export const updateShopConfig = async (data: UpdateShopConfigData): Promise<ShopConfigResponse> => {
  const res = await api.put('/shop', data);
  return res.data;
};
