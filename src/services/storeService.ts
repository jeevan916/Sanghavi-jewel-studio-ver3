
import { Product, User, GeneratedDesign, AppConfig, SharedLink, AnalyticsEvent, StaffAccount, ProductStats } from "@/types.ts";

export function getProxyPath(endpoint: string) {
    const [pathPart, ...queryParts] = endpoint.split('?');
    const queryPart = queryParts.join('?');
    let clean = pathPart.startsWith('/api') ? pathPart.substring(4) : pathPart;
    if (!clean.startsWith('/')) clean = '/' + clean;
    // Basic encoding to obscure paths from scrapers
    return '/_proxy/' + btoa(encodeURIComponent(clean)).replace(/=/g, '') + (queryPart ? '?' + queryPart : '');
}

export function getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    // Bypassing express redirect to directly hit the CDN / Live server for uploads
    // This removes the 302 hop, speeding up image loading significantly
    if (path.startsWith('/uploads')) {
        const cdnBase = import.meta.env.VITE_CDN_URL || '';
        return cdnBase ? `${cdnBase}${path}` : path;
    }
    return path;
}

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
// In-memory cache map for faster navigation
const productCacheMap = new Map<string, { data: any, timestamp: number }>();
const singleProductCacheMap = new Map<string, { data: Product, timestamp: number }>();

const CACHE = {
  products: null as Product[] | null,
  curated: null as CuratedCollections | null,
  config: null as AppConfig | null,
  lastFetch: 0,
  goldRate: null as { k22: number, k24: number, lastFetch: number } | null
};

export async function apiFetch(endpoint: string, options: RequestInit = {}, retries = 2) {
    // Reduce retries for GET requests to improve perceived speed
    const maxRetries = options.method === 'POST' || options.method === 'PUT' ? retries : 0;
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const userStr = localStorage.getItem('sanghavi_user_session');
            const localHeaders: Record<string, string> = {};
            
            // Only set Content-Type to JSON if body is NOT FormData
            if (!(options.body instanceof FormData)) {
                localHeaders['Content-Type'] = 'application/json';
            }

            if (userStr) {
                try {
                    const sessionData = JSON.parse(userStr);
                    if (sessionData && sessionData.id && sessionData.role) {
                        localHeaders['X-User-Id'] = sessionData.id;
                        localHeaders['X-User-Role'] = sessionData.role;
                    }
                    if (sessionData && sessionData.token) {
                        localHeaders['Authorization'] = `Bearer ${sessionData.token}`;
                        localHeaders['X-Auth-Token'] = sessionData.token;
                    }
                } catch (e) {}
            }

            const response = await fetch(getProxyPath(endpoint), {
                ...options,
                headers: { ...localHeaders, ...options.headers },
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
  getImageUrl,
  // NEW: Synchronously retrieve data if available
  getCached: () => ({ ...CACHE }),

  // NEW: Trigger background fetch to populate cache (called on App load)
  warmup: async () => {
     if (Date.now() - CACHE.lastFetch < 120000 && CACHE.products) return; // Cache valid for 2 mins
     try {
         console.log("🔥 [Store] Warming up cache...");
         storeService.getConfig().catch(e => console.warn("Config warmup failed", e));
         storeService.getCuratedProducts().catch(e => console.warn("Curated warmup failed", e));
         // Warmup default page 1 (matches Gallery BATCH_SIZE = 24)
         storeService.getProducts(1, 24).catch(e => console.warn("Product warmup failed", e));
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
        return (user && typeof user === 'object') ? user : null;
    } catch {
        localStorage.removeItem('sanghavi_user_session');
        return null;
    }
  },

  getCachedProductsSync: (page = 1, limit = 50, filters: any = {}) => {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        summary: 'true'
      });
      
      if (filters.publicOnly !== undefined) {
          queryParams.append('public', String(filters.publicOnly));
      } else {
          queryParams.append('public', 'true');
      }

      if (filters.category && filters.category !== 'All') {
          queryParams.append('category', filters.category);
      }

      if (filters.subCategory && filters.subCategory !== 'All') {
          queryParams.append('subCategory', filters.subCategory);
      }

      if (filters.search) {
          queryParams.append('search', filters.search);
      }
      
      const cacheKey = queryParams.toString();
      const cached = productCacheMap.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < 300000)) {
          return cached.data;
      }
      return null;
  },

  getProducts: async (page = 1, limit = 50, filters: any = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        summary: 'true'
      });
      
      if (filters.publicOnly !== undefined) {
          queryParams.append('public', String(filters.publicOnly));
      } else {
          queryParams.append('public', 'true');
      }

      if (filters.category && filters.category !== 'All') {
          queryParams.append('category', filters.category);
      }

      if (filters.subCategory && filters.subCategory !== 'All') {
          queryParams.append('subCategory', filters.subCategory);
      }

      if (filters.search) {
          queryParams.append('search', filters.search);
      }
      
      const cacheKey = queryParams.toString();
      const cached = productCacheMap.get(cacheKey);
      
      // Serve from cache if available and < 5 mins old
      if (cached && (Date.now() - cached.timestamp < 300000)) {
          // Trigger background revalidate if older than 1 minute
          if (Date.now() - cached.timestamp > 60000) {
              apiFetch(`/products?${cacheKey}`).then(data => {
                  const result = { 
                    items: Array.isArray(data.items) ? data.items : [], 
                    meta: data.meta || { totalPages: 1, page, limit } 
                  };
                  productCacheMap.set(cacheKey, { data: result, timestamp: Date.now() });
                  if (page === 1 && (!filters.category || filters.category === 'All') && !filters.search) {
                      CACHE.products = result.items;
                      CACHE.lastFetch = Date.now();
                  }
              }).catch(() => {});
          }
          return cached.data;
      }

      const data = await apiFetch(`/products?${cacheKey}`);
      
      const result = { 
        items: Array.isArray(data.items) ? data.items : [], 
        meta: data.meta || { totalPages: 1, page, limit } 
      };

      // Seed single product cache
      result.items.forEach((p: Product) => {
          singleProductCacheMap.set(p.id, { data: p, timestamp: Date.now() });
      });

      // Store in query cache map
      productCacheMap.set(cacheKey, { data: result, timestamp: Date.now() });

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

  getCachedProductByIdSync: (id: string): Product | null => {
      const cached = singleProductCacheMap.get(id);
      const isSummary = cached && (!cached.data.images || cached.data.images.length === 0);
      if (cached && (Date.now() - cached.timestamp < 300000) && !isSummary) {
          return cached.data;
      }
      return null;
  },

  getProductById: async (id: string): Promise<Product | null> => {
      try {
          const cached = singleProductCacheMap.get(id);
          const isSummary = cached && (!cached.data.images || cached.data.images.length === 0);
          
          if (cached && (Date.now() - cached.timestamp < 300000) && !isSummary) {
              if (Date.now() - cached.timestamp > 60000) {
                  apiFetch(`/products/${id}`).then(p => {
                      if (p) singleProductCacheMap.set(id, { data: p, timestamp: Date.now() });
                  }).catch(() => {});
              }
              return cached.data;
          }
          
          const p = await apiFetch(`/products/${id}`);
          if (p) singleProductCacheMap.set(id, { data: p, timestamp: Date.now() });
          return p;
      } catch (e) {
          console.error(`Product ${id} fetch failed`, e);
          return null;
      }
  },
  
  getProductStats: (id: string): Promise<ProductStats> => 
    apiFetch(`/products/${id}/stats`).catch(() => ({ like: 0, dislike: 0, inquiry: 0, sold: 0, view: 0 })),
  
  addToWishlist: async (customerId: string, productId: string, priceWhenWishlisted?: number, preferences?: any) => {
    return apiFetch('/wishlist', { method: 'POST', body: JSON.stringify({ customerId, productId, priceWhenWishlisted, preferences }) });
  },

  removeFromWishlist: async (customerId: string, productId: string) => {
    return apiFetch('/wishlist', { method: 'DELETE', body: JSON.stringify({ customerId, productId }) });
  },

  getWishlist: async (customerId: string) => {
    return apiFetch(`/wishlist/${customerId}`).catch(() => []);
  },

  getRelatedProducts: (id: string): Promise<Product[]> => 
    apiFetch(`/products/${id}/related`).catch(() => []),

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

  verifySession: async (): Promise<boolean> => {
      try {
          const userStr = localStorage.getItem('sanghavi_user_session');
          if (!userStr) return false;
          const user = JSON.parse(userStr);
          if (!user?.token || !user?.role) return false;
          
          await apiFetch('/auth/verify', { method: 'GET' }, 0);
          return true;
      } catch (e: any) {
          // Only remove session if it's an explicit unauthorized error
          if (e.message?.includes('401') || e.message?.includes('403') || e.message?.toLowerCase().includes('unauthorized') || e.message?.toLowerCase().includes('forbidden')) {
              localStorage.removeItem('sanghavi_user_session');
              return false;
          }
          // If it's 500 or 503 (database starting up), keep the session alive
          console.warn('Session verification failed with server error, assuming valid:', e.message);
          return true;
      }
  },

  getLikes: () => {
    try {
      return JSON.parse(localStorage.getItem('sanghavi_likes') || '[]');
    } catch { return []; }
  },
  
  getRecentViews: () => {
    try {
      return JSON.parse(localStorage.getItem('sanghavi_recent_views') || '[]');
    } catch { return []; }
  },

  addRecentView: (product: Product) => {
    try {
      const views = storeService.getRecentViews();
      const newView = { id: product.id, title: product.title, category: product.category, ts: Date.now() };
      const filtered = views.filter((v: any) => v.id !== product.id);
      filtered.unshift(newView);
      localStorage.setItem('sanghavi_recent_views', JSON.stringify(filtered.slice(0, 12))); // Keep last 12
    } catch {}
  },
  
  toggleLike: (productId: string) => {
    const likes = storeService.getLikes();
    const idx = likes.indexOf(productId);
    const newLikes = idx === -1 ? [...likes, productId] : likes.filter((id: string) => id !== productId);
    localStorage.setItem('sanghavi_likes', JSON.stringify(newLikes));
    return idx === -1;
  },

  logEvent: (type: string, product?: Product, user?: User, extra?: any) => {
    const u = user || storeService.getCurrentUser() || { id: 'anonymous', name: 'Guest' } as any;
    return apiFetch('/analytics', {
      method: 'POST',
      body: JSON.stringify({
        type, productId: product?.id, productTitle: product?.title,
        userId: u.id, userName: u.name, userPhone: u.phone,
        ...extra
      })
    }).catch(() => {});
  },

  getConfig: async (): Promise<AppConfig> => {
    if (CACHE.config) return CACHE.config;
    try {
        const data = await apiFetch('/config');
        
        // Helper to safely parse templates
        const parseTemplates = (jsonStr: string) => {
            try { return JSON.parse(jsonStr || '[]'); } catch { return []; }
        };

        // Construct nested AI Config from flat keys
        const aiConfig = {
            models: {
                analysis: data?.ai_model_analysis || 'gemini-3.5-flash',
                enhancement: data?.ai_model_enhancement || 'gemini-3.1-flash-image',
                watermark: data?.ai_model_watermark || 'gemini-3.1-flash-image',
                design: data?.ai_model_design || 'gemini-3.1-flash-image'
            },
            prompts: {
                analysis: data?.ai_prompt_analysis || 'Analyze this jewelry...',
                enhancement: data?.ai_prompt_enhancement || 'Professional jewelry studio photography. Improve lighting, clarity, and aesthetics. STRICTLY PRESERVE the exact original shape, structure, and fine details. Do NOT add noise or clutter.',
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
            whatsappWishlistTemplateName: data?.whatsappWishlistTemplateName || 'wishlist_price_drop',
            instagramHandle: data?.instagramHandle || '',
            instagramToken: data?.instagramToken || '',
            goldRate22k: Number(data?.goldRate22k) || 6500,
            goldRate24k: Number(data?.goldRate24k) || 7200,
            gstPercent: Number(data?.gstPercent) || 3,
            paymentPlans: Array.isArray(data?.paymentPlans) ? data.paymentPlans : [{ months: 1, advancePercent: 20 }, { months: 3, advancePercent: 50 }],
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
            paymentPlans: [{ months: 1, advancePercent: 20 }, { months: 3, advancePercent: 50 }],
            makingChargeSegments: [],
            defaultMakingChargeSegmentId: '',
            whatsappNumber: '',
            whatsappPhoneId: '',
            whatsappToken: '',
            whatsappTemplateName: 'sanghavi_jewel_studio',
            instagramHandle: '',
            instagramToken: '',
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

  getInstagramFeed: async (limit: number = 3): Promise<any[]> => {
      try {
          const config = await storeService.getConfig();
          if (!config.instagramToken) {
              console.warn("No Instagram Token supplied in Settings. Returning empty feed.");
              return [];
          }
          const token = config.instagramToken;
          let igAccountId = null;
          
          const mePageRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=instagram_business_account&access_token=${token}`);
          const mePageData = await mePageRes.json();
          if (mePageData.instagram_business_account?.id) {
              igAccountId = mePageData.instagram_business_account.id;
          }

          if (!igAccountId) {
              const pagesRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=instagram_business_account&access_token=${token}`);
              const pagesData = await pagesRes.json();
              for (const page of (pagesData.data || [])) {
                  if (page.instagram_business_account?.id) {
                      igAccountId = page.instagram_business_account.id;
                      break;
                  }
              }
          }
          
          if (igAccountId) {
              const url = `https://graph.facebook.com/v20.0/${igAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=${limit}&access_token=${token}`;
              const res = await fetch(url);
              const data = await res.json();
              if (data.data) return data.data;
          } else {
              const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink&limit=${limit}&access_token=${token}`;
              const res = await fetch(url);
              const data = await res.json();
              if (data.data) return data.data;
          }
          
          return [];
      } catch (e) {
          console.error("Instagram Fetch Error:", e);
          return [];
      }
  },

  syncInstagramComments: async () => {
      return apiFetch('/instagram/sync', { method: 'POST' });
  },

  getInstagramComments: async () => {
      return apiFetch('/instagram/comments');
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
    const goldRate = product.category?.toLowerCase()?.includes('24k') ? config.goldRate24k : config.goldRate22k;
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
  getAnalytics: async (): Promise<AnalyticsEvent[]> => {
      const data = await apiFetch('/analytics').catch(() => []);
      return data.map((e: any) => ({
          ...e,
          meta: typeof e.meta === 'string' ? JSON.parse(e.meta || '{}') : e.meta
      }));
  },
  getCustomerAnalytics: async (userId: string): Promise<AnalyticsEvent[]> => {
      const data = await apiFetch(`/analytics/user/${userId}`).catch(() => []);
      return data.map((e: any) => ({
          ...e,
          meta: typeof e.meta === 'string' ? JSON.parse(e.meta || '{}') : e.meta
      }));
  },
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
  downloadBackupUrl: (name: string) => getProxyPath(`/backups/download/${name}`),
  getDiagnostics: () => apiFetch('/diagnostics').catch(e => ({ status: 'error', error: e.message })),
  optimizeStorage: () => apiFetch('/admin/optimize-storage', { method: 'POST' }),
  getDebugEnv: () => apiFetch('/debug-env').catch(e => ({ status: 'error', error: e.message })),
  retryDatabase: () => apiFetch('/retry-db', { method: 'GET' }).catch(e => ({ status: 'error', error: e.message })),

  // --- WHATSAPP INTEGRATIONS ---
  subscribeWhatsApp: (name: string, phone: string, subscribed: boolean) => 
    apiFetch('/whatsapp/subscribe', { method: 'POST', body: JSON.stringify({ name, phone, subscribed }) }),
  checkWhatsAppSubscriptionStatus: (phone: string) => 
    apiFetch('/whatsapp/check-status', { method: 'POST', body: JSON.stringify({ phone }) }),
  getWhatsAppTemplates: () => 
    apiFetch('/whatsapp/templates').catch(() => []),
  saveWhatsAppTemplate: (template: any) => 
    apiFetch('/whatsapp/templates', { method: 'POST', body: JSON.stringify(template) }),
  deleteWhatsAppTemplate: (id: string) => 
    apiFetch(`/whatsapp/templates/${id}`, { method: 'DELETE' }),
  syncWhatsAppTemplate: (id: string) => 
    apiFetch(`/whatsapp/templates/${id}/sync`, { method: 'POST' }),
  getWhatsAppLogs: () => 
    apiFetch('/whatsapp/logs').catch(() => []),
  clearWhatsAppLogs: () => 
    apiFetch('/whatsapp/logs/clear', { method: 'POST' }),
  getWhatsAppSubscribers: () => 
    apiFetch('/whatsapp/subscribers').catch(() => []),
  sendManualWhatsApp: (data: any) => 
    apiFetch('/whatsapp/send-manual', { method: 'POST', body: JSON.stringify(data) }),
  triggerWhatsAppGoldRateBroadcast: () => 
    apiFetch('/whatsapp/trigger-gold-rate', { method: 'POST' })
};
