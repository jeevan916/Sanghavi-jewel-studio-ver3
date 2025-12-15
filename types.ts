export type Product = {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  weight: number;
  description: string;
  tags: string[];
  images: string[];
  price?: number;
  supplier?: string;
  uploadedBy?: string;
  isHidden: boolean; // Acts as "Private"
  createdAt: string;
  dateTaken?: string;
  meta: {
    cameraModel?: string;
    location?: string;
  };
};

export type Category = 'Necklace' | 'Ring' | 'Earrings' | 'Bracelet' | 'Bangle' | 'Set' | 'Other' | string;

export type UserRole = 'customer' | 'contributor' | 'admin';

export type User = {
  id: string;
  name: string;
  role: UserRole;
};

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';

export interface GeneratedDesign {
  id: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: AspectRatio;
  createdAt: string;
}

export interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'saving' | 'complete' | 'error';
  error?: string;
  productTitle?: string;
  supplier?: string;
  device?: string;
}

// --- New Configuration Types ---

export interface Supplier {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface CategoryConfig {
  id: string;
  name: string;
  subCategories: string[];
  isPrivate: boolean;
}

export interface AppConfig {
  suppliers: Supplier[];
  categories: CategoryConfig[];
  linkExpiryHours: number;
  whatsappNumber?: string;
}

export interface SharedLink {
  id: string;
  targetId: string; // Product ID or Category Name
  type: 'product' | 'category';
  token: string;
  expiresAt: string;
}