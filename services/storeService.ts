
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount, ProductStats } from "../types";

const API_BASE = '/api';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

async function apiFetch(endpoint: string, options: RequestInit = {}, retries = 2) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Error (${response.status})`);
            return data;
        } catch (err: any) {
            lastError = err;
            if (i < retries) await sleep(1000 * (i + 1));
        }
    }
    throw lastError;
}

export const storeService = {
  checkServerHealth: async (): Promise<HealthStatus> => {
    try {
        const data = await apiFetch('/health', {}, 0);
        return { healthy: data.status === 'online' };
    } catch (e: any) { return { healthy: false, reason: e.message }; }
  },

  getCurrentUser: (): User | null => {
    try {
        const item = localStorage.getItem('sanghavi_user_session');
        if (!item) return null;
        const user = JSON.parse(item);
        // Robustness: Ensure we have a valid object and it's not a legacy string
        return (user && typeof user === 'object' && user.id) ? user : null;
    } catch {
        localStorage.removeItem('sanghavi_user_session'); // Clear corrupted session
        return null;
    }
  },

  getProducts: async (page = 1, limit = 20, filters: any = {}) => {
    try {
      return await apiFetch(`/products`);
    } catch { return { items: [], meta: { totalPages: 1 } }; }
  },

  getProductById: (id: string): Promise<Product> => apiFetch(`/products/${id}`),
  
  getProductStats: (id: string): Promise<ProductStats> => 
    apiFetch(`/products/${id}/stats`).catch(() => ({ like: 0, dislike: 0, inquiry: 0, purchase: 0 })),

  login: async (username: string, password: string) => {
    const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    localStorage.setItem('sanghavi_user_session', JSON.stringify(data.user));
    return data.user;
  },

  loginWithWhatsApp: async (phone: string, name?: string, pincode?: string, location?: any) => {
    const data = await apiFetch('/customers/login', { 
      method: 'POST', 
      body: JSON.stringify({ phone, name, pincode, location }) 
    });
    localStorage.setItem('sanghavi_user_session', JSON.stringify(data.user));
    return data.user;
  },

  checkCustomerExistence: (phone: string) => apiFetch(`/customers/check/${phone}`),
  
  logout: () => localStorage.removeItem('sanghavi_user_session'),

  getLikes: () => JSON.parse(localStorage.getItem('sanghavi_likes') || '[]'),
  
  toggleLike: (productId: string) => {
    const likes = storeService.getLikes();
    const idx = likes.indexOf(productId);
    const newLikes = idx === -1 ? [...likes, productId] : likes.filter((id: string) => id !== productId);
    localStorage.setItem('sanghavi_likes', JSON.stringify(newLikes));
    return idx === -1;
  },

  logEvent: (type: string, product?: Product, user?: User) => {
    const u = user || storeService.getCurrentUser();
    if (!u) return Promise.resolve();
    return apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({
        type, productId: product?.id, productTitle: product?.title,
        userId: u.id, userName: u.name
      })
    }).catch(() => {});
  },

  getConfig: (): Promise<AppConfig> => apiFetch('/config').catch(() => ({ suppliers: [], categories: [], linkExpiryHours: 24 })),
  saveConfig: (c: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(c) }),
  
  addProduct: (p: Product) => apiFetch('/products', { method: 'POST', body: JSON.stringify(p) }),
  updateProduct: (p: Product) => apiFetch(`/products/${p.id}`, { method: 'PUT', body: JSON.stringify(p) }),

  getUnlockedCategories: () => JSON.parse(sessionStorage.getItem('sanghavi_unlocked_cats') || '[]'),
  unlockCategory: (name: string) => {
    const cats = storeService.getUnlockedCategories();
    if (!cats.includes(name)) sessionStorage.setItem('sanghavi_unlocked_cats', JSON.stringify([...cats, name]));
  },

  shareToWhatsApp: async (product: Product, imageIndex: number = 0) => {
    const config = await storeService.getConfig();
    const text = encodeURIComponent(`Interested in ${product.title}. Ref: ${window.location.origin}/#/product/${product.id}`);
    window.open(`https://wa.me/${config.whatsappNumber}?text=${text}`, '_blank');
  },
  
  getIsOnline: () => navigator.onLine,
  subscribeStatus: (cb: (s: boolean) => void) => {
    const h = () => cb(navigator.onLine);
    window.addEventListener('online', h);
    window.addEventListener('offline', h);
    return () => { window.removeEventListener('online', h); window.removeEventListener('offline', h); };
  },

  getDesigns: (): Promise<GeneratedDesign[]> => apiFetch('/designs').catch(() => []),
  addDesign: (d: GeneratedDesign) => apiFetch('/designs', { method: 'POST', body: JSON.stringify(d) }),
  getAnalytics: (): Promise<AnalyticsEvent[]> => apiFetch('/analytics').catch(() => []),
  getCustomers: (): Promise<User[]> => apiFetch('/customers').catch(() => []),
  getBusinessIntelligence: () => apiFetch('/intelligence').catch(() => null),
  chatWithLead: (customer: User) => {
    window.open(`https://wa.me/${customer.phone}`, '_blank');
  },
  getCuratedProducts: (): Promise<CuratedCollections> => 
    apiFetch('/products/curated').catch(() => ({ latest: [], loved: [], trending: [], ideal: [] })),
  getStaff: (): Promise<StaffAccount[]> => apiFetch('/staff').catch(() => []),
  addStaff: (s: any): Promise<StaffAccount> => apiFetch('/staff', { method: 'POST', body: JSON.stringify(s) }),
  updateStaff: (id: string, updates: any): Promise<StaffAccount> => apiFetch(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteStaff: (id: string) => apiFetch(`/staff/${id}`, { method: 'DELETE' }),
  createSharedLink: (targetId: string, type: string) => 
    apiFetch('/links', { method: 'POST', body: JSON.stringify({ targetId, type }) }).then(res => `${window.location.origin}/#/shared/${res.token}`),
  getSharedLinkDetails: (token: string): Promise<SharedLink> => apiFetch(`/links/${token}`),
  getBackups: () => apiFetch('/backups').catch(() => []),
  createBackup: () => apiFetch('/backups', { method: 'POST' }),
  deleteBackup: (name: string) => apiFetch(`/backups/${name}`, { method: 'DELETE' }),
  downloadBackupUrl: (name: string) => `${API_BASE}/backups/download/${name}?key=${process.env.API_KEY}`
};
