export type Product = {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  weight: number;
  description: string;
  tags: string[];
  images: string[];
  supplier?: string;
  uploadedBy?: string;
  isHidden: boolean;
  privateNotes?: string;
  createdAt: string;
  dateTaken?: string;
  meta: {
    cameraModel?: string;
    deviceManufacturer?: string;
    location?: string;
  };
};

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

export interface AnalyticsEvent {
  id: string;
  type: 'inquiry' | 'screenshot' | 'view';
  productId: string;
  productTitle: string;
  userName: string;
  deviceName: string;
  timestamp: string;
  imageIndex?: number;
}

export interface SharedLink {
  id: string;
  targetId: string;
  type: 'product' | 'category';
  token: string;
  expiresAt: string;
}

export interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'saving' | 'complete' | 'error';
  supplier: string;
  category: string;
  subCategory: string;
  weight: number;
  device: string;
  manufacturer?: string;
  productTitle?: string;
  error?: string;
}