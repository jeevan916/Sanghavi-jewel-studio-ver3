
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

// Memory Cache (RAM) - Enables Instant Navigation
const CACHE = {
  products: null as Product[] | null,
  curated: null as CuratedCollections | null,
  config: null as AppConfig | null,
  lastFetch: 0
};

async function apiFetch(endpoint: string, options: RequestInit = {}, retries = 2) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers },
            });

            const contentType = response.headers.get("content-type");
            let data;
            
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server returned unexpected response: ${text.slice(0, 50)}...`);
            }

            if (!response.ok) {
                throw new Error(data.error || `Server Error (${response.status})`);
            }
            return data;
        } catch (err: any) {
            lastError = err;
            if (i < retries) {
                console.warn(`Fetch attempt ${i + 1} failed for ${endpoint}. Retrying...`);
                await sleep(500 * (i + 1));
            }
        }
    }
    throw lastError;
}

export const storeService = {
  // NEW: Synchronously retrieve data if available
  getCached: () => ({ ...CACHE }),

  // NEW: Trigger background fetch to populate cache (called on App load)
  warmup: async () => {
     if (Date.now() - CACHE.lastFetch < 120000 && CACHE.products) return; // Cache valid for 2 mins
     try {
         console.log("🔥 [Store] Warming up cache...");
         storeService.getConfig().catch(e => console.warn("Config warmup failed", e));
         storeService.getCuratedProducts().catch(e => console.warn("Curated warmup failed", e));
         storeService.getProducts(1, 50).catch(e => console.warn("Product warmup failed", e));
     } catch (e) { console.warn("Warmup error", e); }
  },

  checkServerHealth: async (): Promise<HealthStatus> => {
    try {
        const data = await apiFetch('/health', { method: 'GET' }, 0);
        return { healthy: data.status === 'online' };
    } catch (e: any) { 
        return { healthy: false, reason: e.message || 'Server unreachable' }; 
    }
  },

  getCurrentUser: (): User | null => {
    try {
        const item = localStorage.getItem('sanghavi_user_session');
        if (!item) return null;
        const user = JSON.parse(item);
        return (user && typeof user === 'object' && user.id) ? user : null;
    } catch {
        localStorage.removeItem('sanghavi_user_session');
        return null;
    }
  },

  getProducts: async (page = 1, limit = 50, filters: any = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (filters.publicOnly) {
          queryParams.append('public', 'true');
      }
      
      const data = await apiFetch(`/products?${queryParams.toString()}`);
      
      const result = { 
        items: Array.isArray(data.items) ? data.items : [], 
        meta: data.meta || { totalPages: 1, page, limit } 
      };

      // CACHE STRATEGY: Update memory cache if it's the main default view
      const isDefaultView = page === 1 && (!filters || Object.keys(filters).length <= 1);
      if (isDefaultView) {
          CACHE.products = result.items;
          CACHE.lastFetch = Date.now();
      }

      return result;
    } catch { 
      return { items: [], meta: { totalPages: 1 } }; 
    }
  },

  getProductById: async (id: string): Promise<Product | null> => {
      try {
          return await apiFetch(`/products/${id}`);
      } catch (e) {
          console.error(`Product ${id} fetch failed`, e);
          return null;
      }
  },
  
  getProductStats: (id: string): Promise<ProductStats> => 
    apiFetch(`/products/${id}/stats`).catch(() => ({ like: 0, dislike: 0, inquiry: 0, purchase: 0 })),

  login: async (username: string, password: string) => {
    const data = await apiFetch('/login', { 
      method: 'POST', 
      body: JSON.stringify({ username, password }) 
    });
    if (data.user) {
        localStorage.setItem('sanghavi_user_session', JSON.stringify(data.user));
    }
    return data.user;
  },

  loginWithWhatsApp: async (phone: string, name?: string, pincode?: string, location?: any) => {
    const data = await apiFetch('/customers/login', { 
      method: 'POST', 
      body: JSON.stringify({ phone, name, pincode, location }) 
    });
    if (data.user) {
        localStorage.setItem('sanghavi_user_session', JSON.stringify(data.user));
    }
    return data.user;
  },

  checkCustomerExistence: (phone: string) => apiFetch(`/customers/check/${phone}`),
  
  logout: () => localStorage.removeItem('sanghavi_user_session'),

  getLikes: () => {
    try {
      return JSON.parse(localStorage.getItem('sanghavi_likes') || '[]');
    } catch { return []; }
  },
  
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

  getConfig: async (): Promise<AppConfig> => {
    try {
        const data = await apiFetch('/config');
        const sanitized = {
            suppliers: Array.isArray(data?.suppliers) ? data.suppliers : [],
            categories: Array.isArray(data?.categories) ? data.categories : [],
            linkExpiryHours: Number(data?.linkExpiryHours) || 24,
            whatsappNumber: data?.whatsappNumber || '',
            whatsappPhoneId: data?.whatsappPhoneId || '',
            whatsappToken: data?.whatsappToken || ''
        };
        CACHE.config = sanitized;
        return sanitized;
    } catch (e) {
        console.error("Critical: Config Fetch Failed", e);
        return { suppliers: [], categories: [], linkExpiryHours: 24 };
    }
  },

  saveConfig: (c: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(c) }),
  
  addProduct: (p: Product) => apiFetch('/products', { method: 'POST', body: JSON.stringify(p) }),
  updateProduct: (p: Product) => apiFetch(`/products/${p.id}`, { method: 'PUT', body: JSON.stringify(p) }),

  getUnlockedCategories: () => {
    try {
      return JSON.parse(sessionStorage.getItem('sanghavi_unlocked_cats') || '[]');
    } catch { return []; }
  },
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
  getCuratedProducts: async (): Promise<CuratedCollections> => {
    const data = await apiFetch('/products/curated').catch(() => ({ latest: [], loved: [], trending: [], ideal: [] }));
    CACHE.curated = data;
    return data;
  },
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
  downloadBackupUrl: (name: string) => `${API_BASE}/backups/download/${name}?key=${process.env.API_KEY}`,
  getDiagnostics: () => apiFetch('/diagnostics').catch(e => ({ status: 'error', error: e.message }))
};
