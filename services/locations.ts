import api from './api';

// Country selection itself comes from GET /presets (services/presets.ts, if
// present) — this covers the county/sub-county layer underneath it, seeded
// via the backend's Location model.

export interface County {
  _id: string;
  name: string;
  code: string | null;
}

export interface SubCounty {
  _id: string;
  name: string;
}

export async function getCounties(country: string): Promise<{ success: boolean; data: County[] }> {
  const res = await api.get('/presets/counties', { params: { country } });
  return res.data;
}

export async function getSubcounties(countyId: string): Promise<{ success: boolean; data: SubCounty[] }> {
  const res = await api.get('/presets/subcounties', { params: { county: countyId } });
  return res.data;
}
