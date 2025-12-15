import { Product, User, GeneratedDesign, AppConfig, SharedLink } from "../types";

const STORAGE_KEYS = { USER_SESSION: 'sanghavi_user_session' };

// Helpers
const api = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const res = await fetch(`/api${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
};

export const storeService = {
  // Products
  getProducts: async (): Promise<Product[]> => {
    try { return await api<Product[]>('/products'); } 
    catch (e) { console.error(e); return []; }
  },

  addProduct: async (product: Product) => {
    return await api('/products', { method: 'POST', body: JSON.stringify(product) });
  },

  updateProduct: async (updatedProduct: Product) => {
    await api(`/products/${updatedProduct.id}`, { method: 'PUT', body: JSON.stringify(updatedProduct) });
  },

  // Config
  getConfig: async (): Promise<AppConfig> => {
    try { return await api<AppConfig>('/config'); } 
    catch (e) { 
        // Fallback default
        return { suppliers: [], categories: [], linkExpiryHours: 24 }; 
    }
  },

  saveConfig: async (config: AppConfig) => {
    await api('/config', { method: 'POST', body: JSON.stringify(config) });
  },

  // Designs
  getDesigns: async (): Promise<GeneratedDesign[]> => {
    try { return await api<GeneratedDesign[]>('/designs'); } 
    catch (e) { return []; }
  },

  addDesign: async (design: GeneratedDesign) => {
    await api('/designs', { method: 'POST', body: JSON.stringify(design) });
  },

  // Links
  createSharedLink: async (targetId: string, type: 'product' | 'category'): Promise<string> => {
    const config = await storeService.getConfig();
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + config.linkExpiryHours * 60 * 60 * 1000).toISOString();
    
    const newLink: SharedLink = {
      id: Date.now().toString(),
      targetId,
      type,
      token,
      expiresAt
    };

    await api('/links', { method: 'POST', body: JSON.stringify(newLink) });
    return `${window.location.origin}?shareToken=${token}`;
  },

  validateSharedLink: async (token: string): Promise<SharedLink | null> => {
    try { return await api<SharedLink>(`/links/${token}`); } 
    catch { return null; }
  },

  // Auth (Hybrid: Server check + Local Storage persistence)
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    return data ? JSON.parse(data) : null;
  },

  login: async (username: string, password: string): Promise<User | null> => {
    try {
        const user = await api<User>('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
        return user;
    } catch (e) {
        return null;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    window.location.reload();
  }
};