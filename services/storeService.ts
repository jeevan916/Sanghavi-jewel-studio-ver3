
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

// Robust Fetch Wrapper
async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
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
        const data = await apiFetch('/health');
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

  getConfig: async (): Promise<AppConfig> => {
    try {
      const data = await apiFetch('/config');
      return data || DEFAULT_CONFIG;
    } catch (e) { return DEFAULT_CONFIG; }
  },

  saveConfig: (config: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(config) }),

  getStaff: () => apiFetch('/staff'),

  addStaff: (staff: Partial<StaffAccount>) => apiFetch('/staff', { method: 'POST', body: JSON.stringify(staff) }),

  updateStaff: (id: string, updates: Partial<StaffAccount>) => apiFetch(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

  deleteStaff: (id: string) => apiFetch(`/staff/${id}`, { method: 'DELETE' }),

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  login: async (username: string, password: string): Promise<User | null> => {
      const userData = await apiFetch('/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
      });
      localStorage.setItem(KEYS.SESSION, JSON.stringify(userData));
      storeService.logEvent('login', undefined, userData);
      return userData;
  },

  loginWithGoogle: async (credential: string): Promise<User | null> => {
    try {
      const payload = JSON.parse(atob(credential.split('.')[1]));
      const userData: User = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        role: 'customer',
        lastLogin: new Date().toISOString()
      };
      localStorage.setItem(KEYS.SESSION, JSON.stringify(userData));
      storeService.logEvent('login', undefined, userData);
      return userData;
    } catch (e) { return null; }
  },

  updateUserProfile: (updates: Partial<User>) => {
    const current = storeService.getCurrentUser();
    if (current) {
      const updated = { ...current, ...updates };
      localStorage.setItem(KEYS.SESSION, JSON.stringify(updated));
      return updated;
    }
    return null;
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
        userEmail: user?.email,
        userPhone: user?.phone,
        deviceName: navigator.userAgent,
        timestamp: new Date().toISOString(),
        imageIndex
    };
    try {
        await apiFetch('/analytics', { method: 'POST', body: JSON.stringify(event) });
    } catch (e) {}
  },

  getAnalytics: () => apiFetch('/analytics'),

  getDesigns: async (): Promise<GeneratedDesign[]> => {
    const data = localStorage.getItem('sanghavi_designs');
    return data ? JSON.parse(data) : [];
  },

  addDesign: async (design: GeneratedDesign) => {
    const existing = await storeService.getDesigns();
    const updated = [design, ...existing].slice(0, 50);
    localStorage.setItem('sanghavi_designs', JSON.stringify(updated));
    return design;
  },

  createSharedLink: async (targetId: string, type: 'product' | 'category'): Promise<string> => {
    const config = await storeService.getConfig();
    const token = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + config.linkExpiryHours * 60 * 60 * 1000).toISOString();
    const newLink = { id: Date.now().toString(), targetId, type, token, expiresAt };
    await apiFetch('/links', { method: 'POST', body: JSON.stringify(newLink) });
    return `${window.location.origin}${window.location.pathname}?id=${targetId}`;
  },

  shareToWhatsApp: async (product: Product, imageIndex: number = 0) => {
    const config = await storeService.getConfig();
    const phone = config.whatsappNumber ? config.whatsappNumber.replace(/\D/g, '') : '';
    
    // Create a direct deep link that the receiver can click to see the product
    const productLink = `${window.location.origin}${window.location.pathname}#/collection?id=${product.id}`;
    
    const message = `*Hi Sanghavi Jewel Studio,*

I'm interested in this jewelry piece:

💎 *Title:* ${product.title}
⚖️ *Weight:* ${product.weight}g
🆔 *Product ID:* #${product.id.slice(-6).toUpperCase()}

🔗 *View details in Studio:* ${productLink}

Please provide more information about this design.`;

    // Log the inquiry event
    storeService.logEvent('inquiry', product, null, imageIndex);

    // Direct redirection to WhatsApp bypasses share sheet
    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` 
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(waUrl, '_blank');
  }
};
