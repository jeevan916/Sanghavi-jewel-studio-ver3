import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent } from "../types";

const API_BASE = '/api';

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
        console.log("[StoreService] Health Diagnostics:", data);
        
        if (data.status === 'online' && data.writeAccess === true) {
            return { healthy: true, path: data.activePath };
        }
        
        return { 
            healthy: false, 
            reason: data.writeError || "Server folder is read-only.",
            path: data.activePath
        };
    } catch (e: any) {
        console.error("[StoreService] Server unreachable:", e);
        return { healthy: false, reason: "Check your internet or server status." };
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

  // --- Inventory Management ---
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
        console.error("Store Save Error:", err);
        throw new Error(err.message || "Upload encountered a network error.");
    }
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

  // --- Settings ---
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

  // --- Designs ---
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

  // --- Links ---
  createSharedLink: async (targetId: string, type: 'product' | 'category'): Promise<string> => {
    const config = await storeService.getConfig();
    const token = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + config.linkExpiryHours * 60 * 60 * 1000).toISOString();
    
    const newLink: SharedLink = { id: Date.now().toString(), targetId, type, token, expiresAt };
    const links: SharedLink[] = JSON.parse(localStorage.getItem('sanghavi_links') || '[]');
    links.push(newLink);
    localStorage.setItem('sanghavi_links', JSON.stringify(links));

    return `${window.location.origin}?shareToken=${token}`;
  },

  validateSharedLink: async (token: string): Promise<SharedLink | null> => {
    const links: SharedLink[] = JSON.parse(localStorage.getItem('sanghavi_links') || '[]');
    const link = links.find(l => l.token === token);
    if (!link) return null;
    if (new Date(link.expiresAt) < new Date()) throw new Error('Link Expired');
    return link;
  },

  // --- Auth ---
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

  // --- Analytics ---
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