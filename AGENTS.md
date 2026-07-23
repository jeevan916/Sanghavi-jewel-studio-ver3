# SANGHAVI JEWEL STUDIO - CORE ENGINES & ARCHITECTURE

## Core Architecture Overview
Sanghavi Jewel Studio is an enterprise luxury jewelry web application built with React, Vite, Express, and MySQL/LocalStorage. All core features are powered by modular engines defined in `src/core/memory.ts` and `src/services/`.

---

## Core Serving Engines

### 1. Core Boot Engine (`src/services/coreEngine.ts` & `src/core/memory.ts`)
- **Purpose**: Acts as the central subconscious on startup.
- **Function**: Validates brand identity (Sanghavi Jewel Studio), design DNA tokens (Cormorant Garamond + Montserrat + #D4AF37 Gold), enforces PostCSS/Vite asset compilation (avoiding CDN leakage), and checks locked features.

### 2. Security Blackout & FLAG_SECURE Engine (`src/components/security/SecurityBlackout.tsx`)
- **Purpose**: Native OS-level screenshot and screen recording defense on mobile platforms.
- **Function**: Leverages a hidden OS password field layer (`autoComplete="current-password"`) to engage Android Chrome's native `FLAG_SECURE` buffer shield. Maintains continuous background focus recovery on page load and route changes.

### 3. Screenshot Prevention Overlay Engine (`src/components/security/SecurityLayer.tsx`)
- **Purpose**: High z-index viewport protection during sensitive UI states.
- **Function**: Mounts a top-level viewport overlay (`z-index: 999999`) across sensitive routes (`/product/`, `/admin`, `/shared/`, `/wishlist`, `/collection`, `/staff`, `/login`). Uses an SVG canvas grid pattern buffer protection, blurs document body on visibility change (`document.hidden`), and intercepts PrintScreen / screenshot shortcut key combinations with alert feedback.

### 4. Store & State Management Engine (`src/services/storeService.ts`)
- **Purpose**: Single Source of Truth (SSOT) for products, categories, staff, settings, and wishlist data.
- **Function**: Handles CRUD operations for product catalogs, manages sync between client local cache and Express backend endpoints (`/api/products`, `/api/staff`, `/api/settings`), and enforces guest access restrictions.

### 5. Dual-Stream Image & Server Sharp Engine (`server.js` & `src/services/geminiService.ts`)
- **Purpose**: High-efficiency media delivery and image processing pipeline.
- **Function**: Uploaded catalog images are processed server-side with Node.js `sharp` into dual WebP streams: 1080p high-resolution primary assets and 300px lightweight thumbnails for sub-100ms gallery rendering.
- **CRITICAL ARCHITECTURAL RULE**: Never store raw image base64 binaries/BLOBs in database rows. Base64 BLOB storage caused severe payload bloat, table locks, and memory overload degradation. All images MUST be saved as WebP files on disk/storage with only relative path URLs (`/uploads/...`) stored in the database.

### 6. Neural Template & Gemini AI Engine (`src/services/geminiService.ts` & `server/routes/ai.js`)
- **Purpose**: AI-powered jewelry analysis, image enhancement, and automated prompt creation with zero key exposure.
- **Function**: Integrates `@google/genai` Flash models via server-side API proxy routes (`/api/ai/*`). The `GEMINI_API_KEY` is loaded exclusively inside Node.js environment processes and is never exposed in browser bundles or client network requests. Generates high-precision product titles, descriptions, categories, metal/gemstone tags, and AI image enhancements.

### 7. Haptic Physics & Gesture Engine (`src/components/ImageViewer.tsx`)
- **Purpose**: Ultra-smooth luxury image inspection experience.
- **Function**: Provides 1:1 synchronized gesture tracking with cubic-bezier inertia release physics and haptic vibration feedback (10ms/20ms/30ms) across gallery swipe interactions.

### 8. High-Performance Infinite Scroll Engine (`src/components/ProductCard.tsx` & Page Components)
- **Purpose**: Scale-proof DOM rendering.
- **Function**: Utilizes `IntersectionObserver` lazy-loading patterns to manage large product catalogs without memory degradation.

### 9. Guest Access Control Engine (`src/services/storeService.ts`)
- **Purpose**: Monetization and IP protection for unauthenticated visitors.
- **Function**: Restricts guest users to 8 gallery items maximum and masks sensitive specs (gold weight, tags, release date).

### 10. WhatsApp OTP & Authentication Engine (`src/services/whatsappService.ts`)
- **Purpose**: Direct client authentication via Meta WhatsApp API.
- **Function**: Dispatches OTP codes over Meta WhatsApp messaging endpoints for quick and secure staff/user verification.
