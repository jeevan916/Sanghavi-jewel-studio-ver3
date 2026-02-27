
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount, ProductStats } from "@/types.ts";

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
         // Warmup default page 1
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
      
      if (filters.publicOnly !== undefined) {
          queryParams.append('public', String(filters.publicOnly));
      } else {
          // Default to public only if not specified, unless explicitly requested all
          queryParams.append('public', 'true');
      }

      if (filters.category && filters.category !== 'All') {
          queryParams.append('category', filters.category);
      }

      if (filters.search) {
          queryParams.append('search', filters.search);
      }
      
      const data = await apiFetch(`/products?${queryParams.toString()}`);
      
      const result = { 
        items: Array.isArray(data.items) ? data.items : [], 
        meta: data.meta || { totalPages: 1, page, limit } 
      };

      // CACHE STRATEGY: Update memory cache only for the default unfiltered view
      const isDefaultView = page === 1 && (!filters.category || filters.category === 'All') && !filters.search;
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
    apiFetch(`/products/${id}/stats`).catch(() => ({ like: 0, dislike: 0, inquiry: 0, sold: 0, view: 0 })),

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
        
        // Helper to safely parse templates
        const parseTemplates = (jsonStr: string) => {
            try { return JSON.parse(jsonStr || '[]'); } catch { return []; }
        };

        // Construct nested AI Config from flat keys
        const aiConfig = {
            models: {
                analysis: data?.ai_model_analysis || 'gemini-3-flash-preview',
                enhancement: data?.ai_model_enhancement || 'gemini-2.5-flash-image',
                watermark: data?.ai_model_watermark || 'gemini-2.5-flash-image',
                design: data?.ai_model_design || 'gemini-2.5-flash-image'
            },
            prompts: {
                analysis: data?.ai_prompt_analysis || 'Analyze this jewelry...',
                enhancement: data?.ai_prompt_enhancement || 'Enhance lighting...',
                watermark: data?.ai_prompt_watermark || 'Remove text...',
                design: data?.ai_prompt_design || 'Create design...'
            },
            templates: {
                analysis: parseTemplates(data?.ai_templates_analysis),
                enhancement: parseTemplates(data?.ai_templates_enhancement),
                watermark: parseTemplates(data?.ai_templates_watermark),
                design: parseTemplates(data?.ai_templates_design)
            }
        };

        const sanitized = {
            suppliers: Array.isArray(data?.suppliers) ? data.suppliers : [],
            categories: Array.isArray(data?.categories) ? data.categories : [],
            linkExpiryHours: Number(data?.linkExpiryHours) || 24,
            whatsappNumber: data?.whatsappNumber || '',
            whatsappPhoneId: data?.whatsappPhoneId || '',
            whatsappToken: data?.whatsappToken || '',
            whatsappTemplateName: data?.whatsappTemplateName || 'sanghavi_jewel_studio',
            goldRate22k: Number(data?.goldRate22k) || 6500,
            goldRate24k: Number(data?.goldRate24k) || 7200,
            gstPercent: Number(data?.gstPercent) || 3,
            makingChargeSegments: Array.isArray(data?.makingChargeSegments) ? data.makingChargeSegments : [],
            defaultMakingChargeSegmentId: data?.defaultMakingChargeSegmentId || '',
            aiConfig: aiConfig
        };
        CACHE.config = sanitized;
        return sanitized;
    } catch (e) {
        console.error("Critical: Config Fetch Failed", e);
        // Fallback default config
        return { 
            suppliers: [], 
            categories: [], 
            linkExpiryHours: 24,
            goldRate22k: 6500,
            goldRate24k: 7200,
            gstPercent: 3,
            makingChargeSegments: [],
            defaultMakingChargeSegmentId: '',
            whatsappNumber: '',
            whatsappPhoneId: '',
            whatsappToken: '',
            whatsappTemplateName: 'sanghavi_jewel_studio',
            aiConfig: {
                models: { 
                    analysis: 'gemini-3-flash-preview', 
                    enhancement: 'gemini-2.5-flash-image', 
                    watermark: 'gemini-2.5-flash-image', 
                    design: 'gemini-2.5-flash-image' 
                },
                prompts: { analysis: '', enhancement: '', watermark: '', design: '' },
                templates: { analysis: [], enhancement: [], watermark: [], design: [] }
            }
        };
    }
  },

  saveConfig: (c: AppConfig) => apiFetch('/config', { method: 'POST', body: JSON.stringify(c) }),
  
  addProduct: (p: Product) => apiFetch('/products', { method: 'POST', body: JSON.stringify(p) }),
  updateProduct: (p: Product) => apiFetch(`/products/${p.id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteProduct: (id: string) => apiFetch(`/products/${id}`, { method: 'DELETE' }),

  getUnlockedCategories: () => {
    try {
      return JSON.parse(sessionStorage.getItem('sanghavi_unlocked_cats') || '[]');
    } catch { return []; }
  },
  unlockCategory: (name: string) => {
    const cats = storeService.getUnlockedCategories();
    if (!cats.includes(name)) sessionStorage.setItem('sanghavi_unlocked_cats', JSON.stringify([...cats, name]));
  },

  getUnlockedProducts: () => {
    try {
      return JSON.parse(sessionStorage.getItem('sanghavi_unlocked_products') || '[]');
    } catch { return []; }
  },
  unlockProduct: (id: string) => {
    const prods = storeService.getUnlockedProducts();
    if (!prods.includes(id)) sessionStorage.setItem('sanghavi_unlocked_products', JSON.stringify([...prods, id]));
  },

  shareToWhatsApp: async (product: Product, imageIndex: number = 0) => {
    const config = await storeService.getConfig();
    const text = encodeURIComponent(`Interested in ${product.title}. Ref: ${window.location.origin}/#/product/${product.id}`);
    window.open(`https://wa.me/${config.whatsappNumber}?text=${text}`, '_blank');
  },
  
  calculatePrice: (product: Product, config: AppConfig) => {
    const goldRate = product.category.toLowerCase().includes('24k') ? config.goldRate24k : config.goldRate22k;
    const basePrice = product.weight * goldRate;
    
    // Determine making charge percentage
    let makingPercent = 12; // Fallback
    
    if (product.meta.makingChargePercent !== undefined) {
      makingPercent = product.meta.makingChargePercent;
    } else {
      const segmentId = product.meta.makingChargeSegmentId || config.defaultMakingChargeSegmentId;
      const segment = config.makingChargeSegments.find(s => s.id === segmentId);
      if (segment) {
        makingPercent = segment.percent;
      }
    }

    const makingCharges = basePrice * (makingPercent / 100);
    const otherCharges = product.meta.otherCharges || 0;
    const subtotal = basePrice + makingCharges + otherCharges;
    const gst = subtotal * (config.gstPercent / 100);
    const total = subtotal + gst;
    
    return {
      basePrice,
      makingCharges,
      makingPercent,
      otherCharges,
      gst,
      total,
      goldRate
    };
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
  getDiagnostics: () => apiFetch('/diagnostics').catch(e => ({ status: 'error', error: e.message })),
  getDebugEnv: () => apiFetch('/debug-env').catch(e => ({ status: 'error', error: e.message })),
  retryDatabase: () => apiFetch('/retry-db', { method: 'GET' }).catch(e => ({ status: 'error', error: e.message }))
};
