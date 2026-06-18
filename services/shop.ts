import api from './api';

export const getShopConfig = async () => {
  const res = await api.get('/shop');
  return res.data;
};

export const updateShopConfig = async (data: any) => {
  const res = await api.put('/shop', data);
  return res.data;
};