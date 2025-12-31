
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount } from "../types";

const API_BASE = '/api';

const DEFAULT_CONFIG: AppConfig = {
    suppliers: [{ id: '1', name: 'Sanghavi In-House', isPrivate: false }],
    categories: [{ id: 'c1', name: 'Necklace', subCategories: ['Choker'], isPrivate: false }],
    linkExpiryHours: 24,
    whatsappNumber: ''
};

const KEYS = {
  SESSION: 'sanghavi_user_session',
  LIKES: 'sanghavi_user_likes'
};

export interface HealthStatus {
    healthy: boolean;
    reason?: string;
}

async function apiFetch(endpoint: string, options: RequestInit = {}, customTimeout = 10000) {
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
        
        if (response.status === 503) throw new Error('Server starting up or unavailable');
        if (response.status === 401) {
            storeService.logout();
            throw new Error('Session expired');
        }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    } catch (err: any) {
        if (err.name === 'AbortError') throw new Error('Request timed out');
        throw err;
    }
}

export const storeService = {
  getIsOnline: () => navigator.onLine,
  
  checkServerHealth: async (): Promise<HealthStatus> => {
    try {
        const data = await apiFetch('/health', {}, 3000);
        return { healthy: data.status === 'online' };
    } catch (e: any) {
        console.warn('[Store] Health check failed:', e.message);
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
      return (data || []).sort((a: Product, b: Product) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (err) { return []; }
  },

  addProduct: (product: Product) => apiFetch('/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (product: Product) => apiFetch(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id: string) => apiFetch(`/products/${id}`, { method: 'DELETE' }),

  // Fix: Added getDesigns to fetch generated design history
  getDesigns: async (): Promise<GeneratedDesign[]> => {
    try {
      const data = await apiFetch('/designs');
      return data || [];
    } catch (e) { return []; }
  },

  // Fix: Added addDesign to save a new generated design
  addDesign: (design: GeneratedDesign) => apiFetch('/designs', { method: 'POST', body: JSON.stringify(design) }),

  // Fix: Added getAnalytics to fetch usage statistics
  getAnalytics: async (): Promise<AnalyticsEvent[]> => {
    try {
      const data = await apiFetch('/analytics');
      return data || [];
    } catch (e) { return []; }
  },

  // Fix: Added loginWithWhatsApp for customer authentication
  loginWithWhatsApp: async (phone: string): Promise<User | null> => {
    const user = await apiFetch('/auth/whatsapp', { method: 'POST', body: JSON.stringify({ phone }) });
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  // Fix: Added loginWithGoogle for social authentication
  loginWithGoogle: async (credential: string): Promise<User | null> => {
    const user = await apiFetch('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  // Fix: Added login for staff authentication
  login: async (username: string, password: string): Promise<User | null> => {
    const user = await apiFetch('/auth/staff', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    return user;
  },

  // Fix: Added updateUserProfile to update local and remote user data
  updateUserProfile: (updates: Partial<User>): User | null => {
    const user = storeService.getCurrentUser();
    if (!user) return null;
    const updated = { ...user, ...updates };
    localStorage.setItem(KEYS.SESSION, JSON.stringify(updated));
    apiFetch('/auth/update', { method: 'POST', body: JSON.stringify(updated) }).catch(() => {});
    return updated;
  },

  // Fix: Added createSharedLink to generate access tokens for items
  createSharedLink: async (targetId: string, type: 'product' | 'category'): Promise<string> => {
    const data = await apiFetch('/links', { method: 'POST', body: JSON.stringify({ targetId, type }) });
    return `${window.location.origin}${window.location.pathname}#/shared/${data.token}`;
  },

  // Fix: Added getStaff for admin personnel management
  getStaff: (): Promise<StaffAccount[]> => apiFetch('/staff'),
  
  // Fix: Added addStaff to register new team members
  addStaff: (staff: Partial<StaffAccount>): Promise<StaffAccount> => 
    apiFetch('/staff', { method: 'POST', body: JSON.stringify(staff) }),

  // Fix: Added updateStaff to modify account permissions or status
  updateStaff: (id: string, updates: Partial<StaffAccount>): Promise<StaffAccount> => 
    apiFetch(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  // Fix: Added deleteStaff to remove internal accounts
  deleteStaff: (id: string): Promise<void> => 
    apiFetch(`/staff/${id}`, { method: 'DELETE' }),

  getConfig: async (): Promise<AppConfig> => {
    try {
      const data = await apiFetch('/config');
      return data || DEFAULT_CONFIG;
    } catch (e) { return DEFAULT_CONFIG; }
  },

  saveConfig: (config: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(config) }),

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

  toggleLike: (productId: string) => {
    const likes = storeService.getLikes();
    const index = likes.indexOf(productId);
    let newLikes = [...likes];
    if (index === -1) newLikes.push(productId);
    else newLikes.splice(index, 1);
    localStorage.setItem(KEYS.LIKES, JSON.stringify(newLikes));
    return index === -1;
  },

  logEvent: async (type: AnalyticsEvent['type'], product?: Product, userOverride?: User | null, imageIndex?: number) => {
    const user = userOverride || storeService.getCurrentUser();
    const event: AnalyticsEvent = {
        id: Date.now().toString(),
        type,
        productId: product?.id,
        productTitle: product?.title,
        userId: user ? user.id : 'Guest',
        userName: user ? user.name : 'Guest',
        deviceName: navigator.userAgent,
        timestamp: new Date().toISOString(),
        imageIndex
    };
    try {
        await apiFetch('/analytics', { method: 'POST', body: JSON.stringify(event) });
    } catch (e) {}
  },

  shareToWhatsApp: async (product: Product, imageIndex: number = 0) => {
    const config = await storeService.getConfig();
    const phone = config.whatsappNumber ? config.whatsappNumber.replace(/\D/g, '') : '';
    const productLink = `${window.location.origin}${window.location.pathname}#/collection?id=${product.id}`;
    const message = `*Hi Sanghavi Jewel Studio,*

I'm interested in: ${product.title} (ID: #${product.id.slice(-6).toUpperCase()})
🔗 Link: ${productLink}`;

    storeService.logEvent('inquiry', product, null, imageIndex);
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }
};
