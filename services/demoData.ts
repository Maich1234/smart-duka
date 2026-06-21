// Mock Database for Demo Mode
import { Product } from './products';
import { Sale } from './sales';
import { Staff } from './staff';
import { Shop } from './shop';
import { OwnerDashboardData, StaffDashboardData } from './dashboard';
import { SalesReportData, ReportPeriod } from './reports';

// Initial Mock Shop
let mockShop: Shop = {
  _id: 'mock-shop-id',
  name: 'Smart Duka Demo',
  address: 'Mombasa Road, Nairobi',
  phone: '+254 712 345 678',
  email: 'demo@smartduka.co.ke',
  taxRate: 16,
  currency: 'KES',
  isActive: true,
};

// Initial Mock User Profiles
export const DEMO_OWNER = {
  _id: 'owner-user-id',
  name: 'Alex Owner',
  email: 'demo@smartduka.com',
  role: 'owner' as const,
  shop: mockShop,
};

export const DEMO_STAFF_USER = {
  _id: 'staff-user-id',
  name: 'Sarah Staff',
  email: 'staff@smartduka.com',
  role: 'staff' as const,
  shop: mockShop,
  permissions: ['record_sale', 'view_inventory', 'create_product'],
};

// Initial Mock Staff Members List
let mockStaffList: Staff[] = [
  {
    _id: 'staff-user-id',
    name: 'Sarah Staff',
    email: 'staff@smartduka.com',
    phone: '+254 799 888 777',
    role: 'staff',
    isActive: true,
    permissions: ['record_sale', 'view_inventory', 'create_product'],
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    _id: 'staff-user-id-2',
    name: 'John Assistant',
    email: 'john@smartduka.com',
    phone: '+254 711 222 333',
    role: 'staff',
    isActive: true,
    permissions: ['record_sale', 'view_inventory'],
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
];

// Initial Mock Products
let mockProducts: Product[] = [
  {
    _id: 'prod-1',
    name: 'Milk 1L',
    description: 'Fresh pasteurized whole milk',
    category: 'Beverages',
    sellingPrice: 120,
    costPrice: 95,
    quantity: 3,
    lowStockAlert: 10,
    productType: 'standard',
    trackInventory: true,
    unitOfMeasure: 'unit',
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'prod-2',
    name: 'Sugar 1kg',
    description: 'Local white sugar',
    category: 'Grains',
    sellingPrice: 150,
    costPrice: 130,
    quantity: 24,
    lowStockAlert: 10,
    productType: 'standard',
    trackInventory: true,
    unitOfMeasure: 'unit',
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'prod-3',
    name: 'Bread Whole Wheat',
    description: 'Sieved whole meal sliced bread',
    category: 'Snacks',
    sellingPrice: 85,
    costPrice: 70,
    quantity: 2,
    lowStockAlert: 8,
    productType: 'standard',
    trackInventory: true,
    unitOfMeasure: 'unit',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'prod-4',
    name: 'Mineral Water 500ml',
    description: 'Purified drinking water',
    category: 'Beverages',
    sellingPrice: 40,
    costPrice: 22,
    quantity: 48,
    lowStockAlert: 15,
    productType: 'standard',
    trackInventory: true,
    unitOfMeasure: 'unit',
    createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'prod-5',
    name: 'Cooking Oil 2L',
    description: 'Triple-refined vegetable oil',
    category: 'Utilities',
    sellingPrice: 420,
    costPrice: 370,
    quantity: 4,
    lowStockAlert: 5,
    productType: 'standard',
    trackInventory: true,
    unitOfMeasure: 'unit',
    createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Initial Mock Sales
let mockSales: Sale[] = [
  {
    _id: 'sale-1',
    invoiceNumber: 'SD-10024',
    items: [
      { productId: 'prod-1', productName: 'Milk 1L', quantity: 2, unitPrice: 120, subtotal: 240 },
      { productId: 'prod-3', productName: 'Bread Whole Wheat', quantity: 1, unitPrice: 85, subtotal: 85 },
    ],
    totalAmount: 325,
    paymentMethod: 'cash',
    staff: { _id: 'staff-user-id', name: 'Sarah Staff', email: 'staff@smartduka.com' },
    createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    _id: 'sale-2',
    invoiceNumber: 'SD-10023',
    items: [
      { productId: 'prod-5', productName: 'Cooking Oil 2L', quantity: 1, unitPrice: 420, subtotal: 420 },
      { productId: 'prod-2', productName: 'Sugar 1kg', quantity: 2, unitPrice: 150, subtotal: 300 },
    ],
    totalAmount: 720,
    paymentMethod: 'mpesa',
    staff: { _id: 'staff-user-id', name: 'Sarah Staff', email: 'staff@smartduka.com' },
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    _id: 'sale-3',
    invoiceNumber: 'SD-10022',
    items: [
      { productId: 'prod-2', productName: 'Sugar 1kg', quantity: 10, unitPrice: 150, subtotal: 1500 },
    ],
    totalAmount: 1500,
    paymentMethod: 'mpesa',
    staff: { _id: 'owner-user-id', name: 'Alex Owner', email: 'demo@smartduka.com' },
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

// Helper to calculate dashboard metrics dynamically
const getMetrics = (role: 'owner' | 'staff') => {
  const today = new Date().toDateString();
  const todaySales = mockSales.filter(s => new Date(s.createdAt).toDateString() === today);
  
  const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
  const cashSalesTotal = todaySales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.totalAmount, 0);
  const mpesaSalesTotal = todaySales.filter(s => s.paymentMethod === 'mpesa').reduce((acc, s) => acc + s.totalAmount, 0);
  const transactionsToday = todaySales.length;

  if (role === 'staff') {
    const staffSales = todaySales.filter(s => s.staff._id === 'staff-user-id');
    return {
      todaySalesTotal: staffSales.reduce((acc, s) => acc + s.totalAmount, 0),
      cashSalesTotal: staffSales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.totalAmount, 0),
      mpesaSalesTotal: staffSales.filter(s => s.paymentMethod === 'mpesa').reduce((acc, s) => acc + s.totalAmount, 0),
      transactionsToday: staffSales.length,
      recentSales: mockSales
        .filter(s => s.staff._id === 'staff-user-id')
        .slice(0, 5)
        .map(s => ({
          _id: s._id,
          invoiceNumber: s.invoiceNumber,
          totalAmount: s.totalAmount,
          paymentMethod: s.paymentMethod,
          createdAt: s.createdAt,
        })),
    } as StaffDashboardData;
  }

  // Owner data
  const totalProducts = mockProducts.length;
  const currentStockValue = mockProducts.reduce((acc, p) => acc + (p.quantity * (p.costPrice ?? 0)), 0);
  const lowStockItems = mockProducts
    .filter(p => p.quantity <= p.lowStockAlert)
    .map(p => ({
      _id: p._id,
      name: p.name,
      quantity: p.quantity,
      lowStockAlert: p.lowStockAlert,
    }));

  const recentTransactions = mockSales.slice(0, 5).map(s => ({
    _id: s._id,
    invoiceNumber: s.invoiceNumber,
    totalAmount: s.totalAmount,
    paymentMethod: s.paymentMethod,
    createdAt: s.createdAt,
    staff: { name: s.staff.name },
  }));

  return {
    todaySalesTotal,
    cashSalesTotal,
    mpesaSalesTotal,
    transactionsToday,
    totalProducts,
    currentStockValue,
    lowStockItems,
    recentTransactions,
    ratingSummary: { avgStars: 4.5, totalRatings: 2 },
  } as OwnerDashboardData;
};

// Generates sales reports dynamically
const getReportsData = (period: ReportPeriod): SalesReportData => {
  const cashTotal = mockSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
  const mpesaTotal = mockSales.filter(s => s.paymentMethod === 'mpesa').reduce((sum, s) => sum + s.totalAmount, 0);
  const totalRevenue = cashTotal + mpesaTotal;
  const totalTransactions = mockSales.length;
  const averageSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Let's create visual trend buckets
  const series = [
    { label: 'Mon', date: '2026-06-15', total: 1200, cashTotal: 400, mpesaTotal: 800, transactionCount: 2 },
    { label: 'Tue', date: '2026-06-16', total: 4500, cashTotal: 2500, mpesaTotal: 2000, transactionCount: 4 },
    { label: 'Wed', date: '2026-06-17', total: 3200, cashTotal: 1200, mpesaTotal: 2000, transactionCount: 3 },
    { label: 'Thu', date: '2026-06-18', total: 1500, cashTotal: 500, mpesaTotal: 1000, transactionCount: 2 },
    { label: 'Fri', date: '2026-06-19', total: totalRevenue, cashTotal, mpesaTotal, transactionCount: totalTransactions },
  ];

  return {
    period,
    rangeStart: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    summary: {
      totalRevenue,
      totalTransactions,
      cashTotal,
      mpesaTotal,
      averageSale,
      expenseTotal: 0,
      netProfit: totalRevenue,
    },
    series,
    topProducts: [
      { productName: 'Sugar 1kg', quantitySold: 12, revenue: 1800 },
      { productName: 'Cooking Oil 2L', quantitySold: 1, revenue: 420 },
      { productName: 'Milk 1L', quantitySold: 2, revenue: 240 },
    ],
    byStaff: [
      { staffName: 'Sarah Staff', total: 1045, transactionCount: 2 },
      { staffName: 'Alex Owner', total: 1500, transactionCount: 1 },
    ],
    ratingSummary: { avgStars: 4.5, totalRatings: 2 },
  };
};

// Dispatch logic for intercepted routes
export const getMockResponse = (url: string, method: string, data: any, params: any): any => {
  // Clean URL
  const cleanUrl = url.split('?')[0];

  // Auth logins
  if (cleanUrl === '/auth/login') {
    const isStaff = data?.email === 'staff@smartduka.com';
    return {
      success: true,
      data: {
        _id: isStaff ? DEMO_STAFF_USER._id : DEMO_OWNER._id,
        name: isStaff ? DEMO_STAFF_USER.name : DEMO_OWNER.name,
        email: isStaff ? DEMO_STAFF_USER.email : DEMO_OWNER.email,
        role: isStaff ? 'staff' : 'owner',
        token: 'demo-token',
        shop: mockShop,
      },
    };
  }

  if (cleanUrl === '/auth/profile') {
    return {
      success: true,
      data: DEMO_OWNER,
    };
  }

  // Dashboard endpoints
  if (cleanUrl === '/dashboard/owner') {
    return {
      success: true,
      data: getMetrics('owner'),
    };
  }

  if (cleanUrl === '/dashboard/staff') {
    return {
      success: true,
      data: getMetrics('staff'),
    };
  }

  // Reports
  if (cleanUrl === '/reports/sales') {
    return {
      success: true,
      data: getReportsData(params?.period || 'daily'),
    };
  }

  // Products CRUD
  if (cleanUrl === '/products') {
    if (method.toLowerCase() === 'get') {
      let filtered = [...mockProducts];
      if (params?.search) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(params.search.toLowerCase()));
      }
      if (params?.category) {
        filtered = filtered.filter(p => p.category === params.category);
      }
      return {
        success: true,
        data: filtered,
        pagination: { page: 1, limit: 20, total: filtered.length, pages: 1 },
      };
    }
    if (method.toLowerCase() === 'post') {
      const newProduct: Product = {
        _id: 'prod-' + Date.now(),
        name: data.name,
        description: data.description || '',
        category: data.category,
        sellingPrice: Number(data.sellingPrice),
        costPrice: Number(data.costPrice),
        quantity: Number(data.quantity || 0),
        lowStockAlert: Number(data.lowStockAlert || 5),
        productType: data.productType || 'standard',
        trackInventory: data.trackInventory ?? true,
        unitOfMeasure: data.unitOfMeasure || 'unit',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockProducts.unshift(newProduct);
      return {
        success: true,
        data: newProduct,
      };
    }
  }

  if (cleanUrl.startsWith('/products/')) {
    const id = cleanUrl.split('/')[2];
    if (method.toLowerCase() === 'get') {
      const p = mockProducts.find(x => x._id === id);
      return { success: !!p, data: p };
    }
    if (method.toLowerCase() === 'put') {
      const index = mockProducts.findIndex(x => x._id === id);
      if (index > -1) {
        mockProducts[index] = { ...mockProducts[index], ...data, updatedAt: new Date().toISOString() };
        return { success: true, data: mockProducts[index] };
      }
    }
    if (method.toLowerCase() === 'delete') {
      mockProducts = mockProducts.filter(x => x._id !== id);
      return { success: true, message: 'Product deleted' };
    }
    if (method.toLowerCase() === 'patch' && cleanUrl.endsWith('/stock')) {
      const index = mockProducts.findIndex(x => x._id === id);
      if (index > -1) {
        mockProducts[index].quantity = Number(data.quantity);
        return { success: true, data: mockProducts[index] };
      }
    }
  }

  // Sales CRUD
  if (cleanUrl === '/sales') {
    if (method.toLowerCase() === 'get') {
      return {
        success: true,
        data: mockSales,
        pagination: { page: 1, limit: 20, total: mockSales.length, pages: 1 },
      };
    }
    if (method.toLowerCase() === 'post') {
      const saleItems = data.items.map((item: any) => {
        const prod = mockProducts.find(p => p._id === item.productId);
        if (prod) {
          prod.quantity = Math.max(prod.quantity - item.quantity, 0); // deduct stock
        }
        return {
          productId: item.productId,
          productName: prod ? prod.name : 'Unknown Product',
          quantity: item.quantity,
          unitPrice: prod ? prod.sellingPrice : 0,
          subtotal: item.quantity * (prod ? prod.sellingPrice : 0),
        };
      });

      const totalAmount = saleItems.reduce((acc: number, item: any) => acc + item.subtotal, 0);
      const newSale: Sale = {
        _id: 'sale-' + Date.now(),
        invoiceNumber: 'SD-' + Math.floor(10000 + Math.random() * 90000),
        items: saleItems,
        totalAmount,
        paymentMethod: data.paymentMethod,
        staff: { _id: 'staff-user-id', name: 'Sarah Staff', email: 'staff@smartduka.com' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockSales.unshift(newSale);
      return {
        success: true,
        data: newSale,
      };
    }
  }

  // Staff CRUD
  if (cleanUrl === '/staff') {
    if (method.toLowerCase() === 'get') {
      return {
        success: true,
        data: mockStaffList,
      };
    }
    if (method.toLowerCase() === 'post') {
      const newStaff: Staff = {
        _id: 'staff-' + Date.now(),
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        role: 'staff',
        isActive: true,
        permissions: ['record_sale', 'view_inventory'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockStaffList.push(newStaff);
      return {
        success: true,
        data: newStaff,
      };
    }
  }

  if (cleanUrl.startsWith('/staff/')) {
    const id = cleanUrl.split('/')[2];
    if (method.toLowerCase() === 'put') {
      const index = mockStaffList.findIndex(x => x._id === id);
      if (index > -1) {
        mockStaffList[index] = { ...mockStaffList[index], ...data, updatedAt: new Date().toISOString() };
        return { success: true, data: mockStaffList[index] };
      }
    }
    if (method.toLowerCase() === 'delete') {
      mockStaffList = mockStaffList.filter(x => x._id !== id);
      return { success: true, message: 'Staff deleted' };
    }
  }

  // Shop Config
  if (cleanUrl === '/shop') {
    if (method.toLowerCase() === 'get') {
      return { success: true, data: mockShop };
    }
    if (method.toLowerCase() === 'put') {
      mockShop = { ...mockShop, ...data };
      return { success: true, data: mockShop };
    }
  }

  // Fallback default response
  return { success: true, data: {} };
};
