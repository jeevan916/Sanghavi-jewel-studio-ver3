
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount, ProductSuggestion } from "../types";

const API_BASE = '/api';

const DEFAULT_CONFIG: AppConfig = {
    suppliers: [{ id: '1', name: 'Sanghavi In-House', isPrivate: false }],
    categories: [
        { id: 'c1', name: 'Necklace', subCategories: ['Choker', 'Long Set'], isPrivate: false },
        { id: 'c2', name: 'Ring', subCategories: ['Solitaire', 'Band'], isPrivate: false },
        { id: 'c3', name: 'Bangles', subCategories: ['Bracelet', 'Kada'], isPrivate: false }
    ],
    linkExpiryHours: 24,
    whatsappNumber: ''
};

const KEYS = {
  SESSION: 'sanghavi_user_session',
  LIKES: 'sanghavi_user_likes',
  DISLIKES: 'sanghavi_user_dislikes',
  OWNED: 'sanghavi_user_owned',
  REQUESTED: 'sanghavi_user_requested'
};

export interface HealthStatus {
    healthy: boolean;
    reason?: string;
    mode?: string;
}

export interface ProductStats {
    like: number;
    dislike: number;
    inquiry: number;
    purchase: number;
}

// Increased timeout to 45s for production robustness
async function apiFetch(endpoint: string, options: RequestInit = {}, customTimeout = 45000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), customTimeout);
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        clearTimeout(timeout);
        
        if (response.status === 503) throw new Error('Vault is syncing. Please wait.');
        if (response.status === 401) {
            storeService.logout();
            throw new Error('Access Revoked.');
        }
        
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Error (${response.status})`);
        return data;
    } catch (err: any) {
        if (err.name === 'AbortError') throw new Error('Connection timed out. Retrying...');
        console.error(`[API Error] ${endpoint}:`, err);
        throw err;
    }
}

export const storeService = {
  getIsOnline: () => navigator.onLine,
  
  checkServerHealth: async (): Promise<HealthStatus> => {
    try {
        const data = await apiFetch('/health', {}, 5000);
        return { healthy: data.status === 'online', mode: data.mode };
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

  getProducts: async (): Promise<Product[]> => {
    try {
      const data = await apiFetch('/products');
      if (!Array.isArray(data)) return [];
      
      const products = data.map((p: any) => {
          if (typeof p.images === 'string') { try { p.images = JSON.parse(p.images); } catch(e) { p.images = []; } }
          if (typeof p.thumbnails === 'string') { try { p.thumbnails = JSON.parse(p.thumbnails); } catch(e) { p.thumbnails = []; } }
          if (typeof p.tags === 'string') { try { p.tags = JSON.parse(p.tags); } catch(e) { p.tags = []; } }
          
          if (!Array.isArray(p.images)) p.images = [];
          if (!Array.isArray(p.thumbnails)) p.thumbnails = [];
          
          return p as Product;
      });
      return products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) { 
        console.error("StoreService getProducts Error:", err);
        throw err; 
    }
  },

  getProductStats: async (productId: string): Promise<ProductStats> => {
      try {
          const stats = await apiFetch(`/stats/${productId}`);
          return stats || { like: 0, dislike: 0, inquiry: 0, purchase: 0 };
      } catch (e) {
          return { like: 0, dislike: 0, inquiry: 0, purchase: 0 };
      }
  },

  addProduct: (product: Product) => apiFetch('/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (product: Product) => apiFetch(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id: string) => apiFetch(`/products/${id}`, { method: 'DELETE' }),

  getCustomers: async (): Promise<User[]> => {
    try {
      const data = await apiFetch('/customers');
      return data || [];
    } catch (e) { return []; }
  },

  checkCustomerExistence: async (phone: string): Promise<{ exists: boolean, user?: any }> => {
     // Do not catch errors here; allow UI to handle network failures instead of assuming 'false' (New User)
     return await apiFetch(`/customers/check/${phone}`);
  },

  loginWithWhatsApp: async (phone: string, name?: string, pincode?: string, location?: any): Promise<User | null> => {
    const user = await apiFetch('/auth/whatsapp', { 
        method: 'POST', 
        body: JSON.stringify({ phone, name, pincode, location }) 
    });
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  login: async (username: string, password: string): Promise<User | null> => {
    const user = await apiFetch('/auth/staff', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
    window.location.hash = '/';
    window.location.reload();
  },

  getLikes: (): string[] => {
    const data = localStorage.getItem(KEYS.LIKES);
    return data ? JSON.parse(data) : [];
  },

  getDislikes: (): string[] => {
    const data = localStorage.getItem(KEYS.DISLIKES);
    return data ? JSON.parse(data) : [];
  },

  getOwned: (): string[] => {
    const data = localStorage.getItem(KEYS.OWNED);
    return data ? JSON.parse(data) : [];
  },

  getRequested: (): string[] => {
    const data = localStorage.getItem(KEYS.REQUESTED);
    return data ? JSON.parse(data) : [];
  },

  toggleLike: (productId: string) => {
    const likes = storeService.getLikes();
    const index = likes.indexOf(productId);
    let newLikes = [...likes];
    if (index === -1) newLikes.push(productId);
    else newLikes.splice(index, 1);
    localStorage.setItem(KEYS.LIKES, JSON.stringify(newLikes));
    return index === -1;
  },

  toggleDislike: (productId: string) => {
    const dislikes = storeService.getDislikes();
    const index = dislikes.indexOf(productId);
    let newDislikes = [...dislikes];
    if (index === -1) newDislikes.push(productId);
    else newDislikes.splice(index, 1);
    localStorage.setItem(KEYS.DISLIKES, JSON.stringify(newDislikes));
    return index === -1;
  },

  toggleOwned: (productId: string) => {
    const owned = storeService.getOwned();
    const index = owned.indexOf(productId);
    let newOwned = [...owned];
    if (index === -1) newOwned.push(productId);
    else newOwned.splice(index, 1);
    localStorage.setItem(KEYS.OWNED, JSON.stringify(newOwned));
    return index === -1;
  },

  toggleRequested: (productId: string) => {
    const requested = storeService.getRequested();
    const index = requested.indexOf(productId);
    let newRequested = [...requested];
    if (index === -1) newRequested.push(productId);
    else newRequested.splice(index, 1);
    localStorage.setItem(KEYS.REQUESTED, JSON.stringify(newRequested));
    return index === -1;
  },

  logEvent: async (type: AnalyticsEvent['type'], product?: Product, userOverride?: User | null, imageIndex?: number) => {
    try {
        const user = userOverride || storeService.getCurrentUser();
        
        // Construct event without client-side ID generation (Server handles ID to prevent crypto crashes)
        const event = {
            type,
            productId: product?.id,
            productTitle: product?.title,
            userId: user ? user.id : 'Guest',
            userName: user ? user.name : 'Guest',
            timestamp: new Date().toISOString()
        };
        
        await fetch(`${API_BASE}/analytics`, { 
            method: 'POST', 
            body: JSON.stringify(event), 
            headers: {'Content-Type': 'application/json'} 
        });
    } catch (e) {
        console.warn("Analytics logging failed:", e);
    }
  },

  submitSuggestion: async (productId: string, suggestion: string) => {
    const user = storeService.getCurrentUser();
    if (!user) return;
    await apiFetch('/suggestions', {
        method: 'POST',
        body: JSON.stringify({
            productId,
            userId: user.id,
            userName: user.name,
            userPhone: user.phone,
            suggestion
        })
    });
  },

  getSuggestions: async (productId: string): Promise<ProductSuggestion[]> => {
     try {
         const data = await apiFetch(`/suggestions/${productId}`);
         return data || [];
     } catch(e) { return []; }
  },

  getConfig: async (): Promise<AppConfig> => {
    try {
      const data = await apiFetch('/config');
      return data && data.categories ? data : DEFAULT_CONFIG;
    } catch (e) { return DEFAULT_CONFIG; }
  },

  saveConfig: (config: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(config) }),

  shareToWhatsApp: async (product: Product, imageIndex: number = 0) => {
    const config = await storeService.getConfig();
    const phone = config.whatsappNumber ? config.whatsappNumber.replace(/\D/g, '') : '';
    const productLink = `${window.location.origin}${window.location.pathname}#/collection?id=${product.id}`;
    const message = `*Hi Sanghavi Jewel Studio,*

I'm interested in: ${product.title} (ID: #${product.id.slice(-6).toUpperCase()})
🔗 Link: ${productLink}`;

    await storeService.logEvent('inquiry', product, null, imageIndex);
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  },

  getDesigns: async (): Promise<GeneratedDesign[]> => {
    try {
      const data = await apiFetch('/designs');
      return data || [];
    } catch (e) { return []; }
  },

  addDesign: (design: GeneratedDesign) => apiFetch('/designs', { method: 'POST', body: JSON.stringify(design) }),

  getAnalytics: async (): Promise<AnalyticsEvent[]> => {
    try {
      const data = await apiFetch('/analytics');
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },

  chatWithLead: (user: User) => {
    const phone = user.phone ? user.phone.replace(/\D/g, '') : '';
    const message = `*Hi ${user.name},* reaching out from Sanghavi Jewel Studio regarding your interest in our collections.`;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  },

  createSharedLink: async (targetId: string, type: 'product' | 'category'): Promise<string> => {
    const response = await apiFetch('/shared-links', { 
        method: 'POST', 
        body: JSON.stringify({ targetId, type }) 
    });
    return `${window.location.origin}${window.location.pathname}#/shared/${response.token}`;
  },

  getStaff: async (): Promise<StaffAccount[]> => {
    try {
      const data = await apiFetch('/staff');
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  },

  addStaff: (staff: Partial<StaffAccount>) => apiFetch('/staff', { method: 'POST', body: JSON.stringify(staff) }),

  updateStaff: (id: string, updates: Partial<StaffAccount>) => apiFetch(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  deleteStaff: (id: string) => apiFetch(`/staff/${id}`, { method: 'DELETE' })
};
