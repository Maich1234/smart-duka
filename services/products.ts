import api from './api';

export type ProductType = 'standard' | 'variable' | 'weighted' | 'refillable' | 'service' | 'bundle' | 'configurable';
export type UnitOfMeasure = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'dozen' | 'pack' | 'box' | 'bag' | 'lb' | 'oz' | 'm' | 'cm' | 'ton';

export interface BundleItem {
  product: string;
  quantity: number;
}

export interface ProductVariant {
  _id: string;
  name: string;
  sellingPrice: number;
  costPrice?: number;
  quantity: number;
  sku?: string;
  lowStockAlert: number;
}

export interface ProductPromotion {
  label?: string;
  buyQty: number;
  freeQty: number;
  isActive?: boolean;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  category: string;
  sellingPrice: number;
  costPrice?: number;
  quantity: number;
  lowStockAlert: number;
  createdAt: string;
  updatedAt: string;
  productType: ProductType;
  trackInventory: boolean;
  unitOfMeasure: UnitOfMeasure;
  minPrice?: number;
  maxPrice?: number;
  allowPriceOverride?: boolean;
  bundleItems?: BundleItem[];
  variants?: ProductVariant[];
  promotions?: ProductPromotion[];
}

export interface ProductsResponse {
  success: boolean;
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ProductResponse {
  success: boolean;
  data: Product;
  message?: string;
}

export interface CreateProductData {
  name: string;
  description?: string;
  category: string;
  productType?: ProductType;
  sellingPrice: number;
  costPrice: number;
  quantity?: number;
  lowStockAlert?: number;
  trackInventory?: boolean;
  unitOfMeasure?: UnitOfMeasure;
  minPrice?: number;
  maxPrice?: number;
  allowPriceOverride?: boolean;
  bundleItems?: BundleItem[];
  variants?: Omit<ProductVariant, '_id'>[];
  promotions?: ProductPromotion[];
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  category?: string;
  productType?: ProductType;
  sellingPrice?: number;
  costPrice?: number;
  quantity?: number;
  lowStockAlert?: number;
  trackInventory?: boolean;
  unitOfMeasure?: UnitOfMeasure;
  minPrice?: number;
  maxPrice?: number;
  allowPriceOverride?: boolean;
  bundleItems?: BundleItem[];
  variants?: Omit<ProductVariant, '_id'>[];
  promotions?: ProductPromotion[];
}

/**
 * Get all products with optional filters
 * @param params - search, category, page, limit
 */
export const getProducts = async (params?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> => {
  const response = await api.get('/products', { params });
  return response.data;
};

/**
 * Get single product by ID
 */
export const getProductById = async (id: string): Promise<ProductResponse> => {
  const response = await api.get(`/products/${id}`);
  return response.data;
};

/**
 * Create new product (Owner only, or staff with 'create_product' permission)
 */
export const createProduct = async (data: CreateProductData): Promise<ProductResponse> => {
  const response = await api.post('/products', data);
  return response.data;
};

/**
 * Update product (Owner only, or staff with 'edit_product' permission)
 */
export const updateProduct = async (id: string, data: UpdateProductData): Promise<ProductResponse> => {
  const response = await api.put(`/products/${id}`, data);
  return response.data;
};

/**
 * Delete product (Owner only, or staff with 'delete_product' permission)
 */
export const deleteProduct = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

/**
 * Update product stock quantity (Owner only, or staff with 'edit_product_stock' permission)
 */
export const updateStock = async (id: string, quantity: number): Promise<ProductResponse> => {
  const response = await api.patch(`/products/${id}/stock`, { quantity });
  return response.data;
};