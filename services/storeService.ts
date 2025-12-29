import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent } from "../types";

// Base API Path - Hostinger usually handles this via a proxy or same-origin mapping
const API_BASE = window.location.origin.includes('localhost') ? '/api' : '/api';

const KEYS = {
  SESSION: 'sanghavi_user_session',
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
        
        if (!res.ok) return { healthy: false, reason: `HTTP ${res.status}: ${res.statusText}` };
        
        const data = await res.json();
        
        if (data.status === 'online' && data.uploadsWritable === true) {
            return { healthy: true };
        }
        
        return { 
            healthy: false, 
            reason: "Server storage check failed."
        };
    } catch (e: any) {
        return { healthy: false, reason: "API server is unreachable." };
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
      if (!res.ok) throw new Error('Failed to fetch products');
      const data = await res.json();
      return (data || []).sort((a: Product, b: Product) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (err) {
      console.error("Store Fetch Error:", err);
      return [];
    }
  },

  getProductById: async (id: string): Promise<Product | null> => {
    const products = await storeService.getProducts();
    return products.find(p => p.id === id) || null;
  },

  addProduct: async (product: Product) => {
    if (!product || !product.images?.length) throw new Error("No image data provided.");

    try {
        const res = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server Error: ${errorText}`);
        }
        
        return await res.json();
    } catch (err: any) {
        throw new Error(err.message || "Upload encountered a network error.");
    }
  },

  updateProduct: async (updatedProduct: Product) => {
    try {
        const res = await fetch(`${API_BASE}/products/${updatedProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        });
        
        if (!res.ok) throw new Error('Update failed');
        return await res.json();
    } catch (err) {
        console.error("Update error:", err);
        throw err;
    }
  },

  deleteProduct: async (id: string) => {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
  },

  getConfig: async (): Promise<AppConfig> => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (res.ok) {
          const data = await res.json();
          if (data) return data;
      }
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
    
    const newLink: SharedLink = { id: Date.now().toString(), targetId, type, token, expiresAt };
    
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
    } catch (e) {
        return null;
    }
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  login: async (username: string, password: string): Promise<User | null> => {
    const u = username.toLowerCase().trim();
    const p = password.trim();
    let userData: User | null = null;
    if (u === 'admin' && p === 'admin') userData = { id: 'admin1', name: 'Admin', role: 'admin' };
    else if (u === 'staff' && p === 'staff') userData = { id: 'staff1', name: 'Staff', role: 'contributor' };
    
    if (userData) localStorage.setItem(KEYS.SESSION, JSON.stringify(userData));
    return userData;
  },

  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
    window.location.reload();
  },

  logEvent: async (type: 'inquiry' | 'screenshot' | 'view', product: Product, user: User | null, imageIndex?: number) => {
    const event: AnalyticsEvent = {
        id: Date.now().toString(),
        type,
        productId: product.id,
        productTitle: product.title,
        userName: user ? user.name : 'Guest',
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
  }
};