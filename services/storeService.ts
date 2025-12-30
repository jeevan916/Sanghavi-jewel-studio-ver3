
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount } from "../types";

const API_BASE = '/api';

const KEYS = {
  SESSION: 'sanghavi_user_session',
  LIKES: 'sanghavi_user_likes'
};

export interface HealthStatus {
    healthy: boolean;
    reason?: string;
    path?: string;
}

export const storeService = {
  getIsOnline: () => navigator.onLine,
  
  checkServerHealth: async (): Promise<HealthStatus> => {
    try {
        const res = await fetch(`${API_BASE}/health`, { 
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' } 
        });
        if (!res.ok) return { healthy: false, reason: `HTTP ${res.status}` };
        const data = await res.json();
        return { healthy: data.status === 'online' };
    } catch (e: any) {
        return { healthy: false, reason: "Server Unreachable (Offline)" };
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
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return (data || []).sort((a: Product, b: Product) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (err) { return []; }
  },

  getProductById: async (id: string): Promise<Product | null> => {
    const products = await storeService.getProducts();
    return products.find(p => p.id === id) || null;
  },

  addProduct: async (product: Product) => {
    const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    });
    return await res.json();
  },

  updateProduct: async (updatedProduct: Product) => {
    const res = await fetch(`${API_BASE}/products/${updatedProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProduct)
    });
    return await res.json();
  },

  deleteProduct: async (id: string) => {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
  },

  getConfig: async (): Promise<AppConfig> => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return {
        suppliers: [{ id: '1', name: 'Sanghavi In-House', isPrivate: false }],
        categories: [{ id: 'c1', name: 'Necklace', subCategories: ['Choker'], isPrivate: false }],
        linkExpiryHours: 24,
        whatsappNumber: ''
    };
  },

  saveConfig: async (config: AppConfig) => {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return await res.json();
  },

  getStaff: async (): Promise<StaffAccount[]> => {
    try {
      const res = await fetch(`${API_BASE}/staff`);
      return await res.json();
    } catch (e) { return []; }
  },

  addStaff: async (staff: Partial<StaffAccount>) => {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staff)
    });
    return await res.json();
  },

  updateStaff: async (id: string, updates: Partial<StaffAccount>) => {
    const res = await fetch(`${API_BASE}/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await res.json();
  },

  deleteStaff: async (id: string) => {
    await fetch(`${API_BASE}/staff/${id}`, { method: 'DELETE' });
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  login: async (username: string, password: string): Promise<User | null> => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}: Access Denied`);
      }

      const userData: User = data;
      localStorage.setItem(KEYS.SESSION, JSON.stringify(userData));
      storeService.logEvent('login', undefined, userData);
      return userData;
    } catch (err: any) {
      console.error("StoreService Login Failed:", err.message);
      throw err; 
    }
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
        await fetch(`${API_BASE}/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
    } catch (e) {}
  },

  getAnalytics: async (): Promise<AnalyticsEvent[]> => {
    try {
        const res = await fetch(`${API_BASE}/analytics`);
        return await res.json();
    } catch (e) { return []; }
  },

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
    await fetch(`${API_BASE}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLink)
    });
    return `${window.location.origin}${window.location.pathname}?shareToken=${token}`;
  },

  validateSharedLink: async (token: string): Promise<SharedLink | null> => {
    try {
        const res = await fetch(`${API_BASE}/links/${token}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) { return null; }
  }
};
