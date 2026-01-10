
// ... existing imports ...
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount, ProductSuggestion } from "../types";

const API_BASE = '/api';

export interface ProductStats {
  like: number;
  dislike: number;
  inquiry: number;
  purchase: number;
}

export interface CuratedCollections {
  latest: Product[];
  loved: Product[];
  trending: Product[];
  ideal: Product[];
}

export interface HealthStatus {
  healthy: boolean;
  reason?: string;
}

// ... existing helper functions ...

export const storeService = {
  // ... existing methods ...

  createBackup: async () => {
    return await apiFetch('/maintenance/backup', { method: 'POST' });
  },

  getBackups: async () => {
    return await apiFetch('/maintenance/backups');
  },

  deleteBackup: async (name: string) => {
    return await apiFetch(`/maintenance/backups/${name}`, { method: 'DELETE' });
  },

  downloadBackupUrl: (name: string) => {
    return `${API_BASE}/maintenance/backups/download/${name}`;
  },

  getIsOnline: () => navigator.onLine,
  
  checkServerHealth: async (): Promise<HealthStatus> => {
    try {
        const data = await apiFetch('/health', {}, 5000);
        return { healthy: data.status === 'online' };
    } catch (e: any) {
        return { healthy: false, reason: e.message };
    }
  },

  subscribeStatus: (cb: (status: boolean) => void) => {
    const handler = () => cb(navigator.onLine);
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  },

  getProducts: async (page = 1, limit = 20, filters: any = {}): Promise<any> => {
    try {
      const data = await apiFetch(`/products`);
      return { items: data.items || [], meta: data.meta || { totalPages: 1 } };
    } catch (err) { 
        return { items: [], meta: { totalPages: 1 } };
    }
  },

  getProductById: async (id: string): Promise<Product | null> => {
    try {
      return await apiFetch(`/products/${id}`);
    } catch (e) { return null; }
  },

  addProduct: async (product: Product) => {
    return await apiFetch('/products', { method: 'POST', body: JSON.stringify(product) });
  },

  updateProduct: async (product: Product) => {
      await apiFetch(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(product) });
  },

  getAnalytics: async (): Promise<AnalyticsEvent[]> => {
    try {
      const data = await apiFetch('/analytics');
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },

  getCustomers: async (): Promise<User[]> => {
    try {
      const data = await apiFetch('/customers');
      return data || [];
    } catch (e) { return []; }
  },

  getBusinessIntelligence: async (): Promise<any> => {
      return { spendingPower: [], regionalDemand: [], engagement: [], devices: [] };
  },

  getConfig: async (): Promise<AppConfig> => {
    try {
      const data = await apiFetch('/config');
      return data && data.categories ? data : { suppliers: [], categories: [], linkExpiryHours: 24 };
    } catch (e) { return { suppliers: [], categories: [], linkExpiryHours: 24 }; }
  },

  saveConfig: (config: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(config) }),

  getCurrentUser: (): User | null => {
    try {
        const item = localStorage.getItem('sanghavi_user_session');
        return item ? JSON.parse(item) : null;
    } catch (e) { return null; }
  },

  getStaff: async (): Promise<StaffAccount[]> => {
    try {
      const data = await apiFetch('/staff');
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },

  addStaff: async (staff: Partial<StaffAccount>) => {
    return await apiFetch('/staff', { method: 'POST', body: JSON.stringify(staff) });
  },

  updateStaff: async (id: string, updates: Partial<StaffAccount>) => {
    return await apiFetch(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
  },

  deleteStaff: async (id: string) => {
    return await apiFetch(`/staff/${id}`, { method: 'DELETE' });
  },

  login: async (username: string, password: string): Promise<User> => {
    const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    localStorage.setItem('sanghavi_user_session', JSON.stringify(data.user));
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('sanghavi_user_session');
  },

  getLikes: (): string[] => {
    return JSON.parse(localStorage.getItem('sanghavi_likes') || '[]');
  },

  toggleLike: (productId: string): boolean => {
    const likes = storeService.getLikes();
    const index = likes.indexOf(productId);
    if (index === -1) {
      likes.push(productId);
      localStorage.setItem('sanghavi_likes', JSON.stringify(likes));
      return true;
    } else {
      likes.splice(index, 1);
      localStorage.setItem('sanghavi_likes', JSON.stringify(likes));
      return false;
    }
  },

  logEvent: async (type: string, product?: Product, user?: User) => {
    const currentUser = user || storeService.getCurrentUser();
    if (!currentUser) return;
    return await apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({
        type,
        productId: product?.id,
        productTitle: product?.title,
        category: product?.category,
        weight: product?.weight,
        userId: currentUser.id,
        userName: currentUser.name
      })
    });
  },

  shareToWhatsApp: async (product: Product, imageIndex: number = 0) => {
    // Logic to generate a WhatsApp link for inquiry
    const phone = (await storeService.getConfig()).whatsappNumber;
    const text = encodeURIComponent(`I am interested in ${product.title} (${product.category}). Link: ${window.location.origin}/#/product/${product.id}`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  },

  getCuratedProducts: async (): Promise<CuratedCollections> => {
    try {
      return await apiFetch('/curated');
    } catch (e) {
      return { latest: [], loved: [], trending: [], ideal: [] };
    }
  },

  getUnlockedCategories: (): string[] => {
    return JSON.parse(sessionStorage.getItem('sanghavi_unlocked_cats') || '[]');
  },

  unlockCategory: (categoryName: string) => {
    const cats = storeService.getUnlockedCategories();
    if (!cats.includes(categoryName)) {
      cats.push(categoryName);
      sessionStorage.setItem('sanghavi_unlocked_cats', JSON.stringify(cats));
    }
  },

  getDesigns: async (): Promise<GeneratedDesign[]> => {
    try {
      return await apiFetch('/designs');
    } catch (e) { return []; }
  },

  addDesign: async (design: GeneratedDesign) => {
    return await apiFetch('/designs', { method: 'POST', body: JSON.stringify(design) });
  },

  chatWithLead: (customer: User) => {
    window.open(`https://wa.me/${customer.phone}`, '_blank');
  },

  getProductStats: async (productId: string): Promise<ProductStats> => {
    try {
      return await apiFetch(`/products/${productId}/stats`);
    } catch (e) {
      return { like: 0, dislike: 0, inquiry: 0, purchase: 0 };
    }
  },

  createSharedLink: async (targetId: string, type: 'product' | 'category'): Promise<string> => {
    const data = await apiFetch('/shared-links', { method: 'POST', body: JSON.stringify({ targetId, type }) });
    return `${window.location.origin}/#/shared/${data.token}`;
  },

  getSharedLinkDetails: async (token: string): Promise<SharedLink> => {
    return await apiFetch(`/shared-links/${token}`);
  },

  checkCustomerExistence: async (phone: string): Promise<{ exists: boolean, user?: User }> => {
    return await apiFetch(`/customers/check/${phone}`);
  },

  loginWithWhatsApp: async (phone: string, name?: string, pincode?: string, location?: any): Promise<User> => {
    const data = await apiFetch('/customers/login', { 
      method: 'POST', 
      body: JSON.stringify({ phone, name, pincode, location }) 
    });
    localStorage.setItem('sanghavi_user_session', JSON.stringify(data.user));
    return data.user;
  }
};

async function apiFetch(endpoint: string, options: RequestInit = {}, customTimeout = 45000) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Error (${response.status})`);
        return data;
    } catch (err: any) {
        throw err;
    }
}
