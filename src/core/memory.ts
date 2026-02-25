
/**
 * SANGHAVI JEWEL STUDIO - CORE MEMORY (THE BRAIN)
 * Version: 4.3.5 (Staff Ops & Auth Upgrade)
 * 
 * This file is the central intelligence of the application.
 * It documents the "Design DNA", "Critical Features", and "Micro-Instructions".
 * AI AGENTS MUST READ THIS BEFORE MAKING CHANGES.
 */

export interface SystemFeature {
    id: string;
    name: string;
    status: 'stable' | 'beta' | 'deprecated';
    critical: boolean; // If true, this feature is LOCKED and must not be removed.
    description: string;
}

export interface DesignDNA {
    fonts: {
        primary: string;   // 'Playfair Display' (Serif)
        secondary: string; // 'Inter' (Sans)
    };
    palette: {
        gold: string;      // #D4AF37 (Brand Gold)
        red: string;       // #E31E24 (Brand Red)
        dark: string;      // #333333 (Brand Dark)
        background: string;// #ffffff (Clean White)
        surface: string;   // #ffffff
    };
    aesthetics: {
        radius: string;    // 'rounded-xl' or 'rounded-2xl'
        animation: string; // 'animate-fade-in'
        physics: string;   // 'cubic-bezier(0.19, 1, 0.22, 1)' (Apple-style)
    };
}

export interface AppMemory {
    version: string;
    identity: string;
    design_dna: DesignDNA;
    architecture_rules: string[];
    micro_instructions: string[];
    locked_features: SystemFeature[];
    fix_log: string[];
}

export const APP_MEMORY: AppMemory = {
    version: "4.3.5",
    identity: "Sanghavi Jewel Studio - Enterprise Edition",
    
    // THE VISUAL IDENTITY
    design_dna: {
        fonts: {
            primary: "Cormorant Garamond",
            secondary: "Montserrat"
        },
        palette: {
            gold: "#D4AF37",
            red: "#E31E24",
            dark: "#333333",
            background: "#ffffff",
            surface: "#ffffff"
        },
        aesthetics: {
            radius: "rounded-2xl",
            animation: "animate-fade-in",
            physics: "cubic-bezier(0.19, 1, 0.22, 1)"
        }
    },

    // TECHNICAL RULES
    architecture_rules: [
        "Project Structure: Flat Root (No 'src' folder nesting).",
        "Styling: PostCSS/Vite Build (No Runtime CDN).",
        "API Logic: 'storeService' is the Single Source of Truth.",
        "Images: Pipeline -> Slugify -> Base64 -> AI -> Buffer -> Sharp -> CDN.",
        "Persistence: MySQL (System Settings) + LocalStorage (Session).",
        "AI: Use @google/genai SDK with Flash models for speed.",
        "Gestures: 1:1 Physics Tracking for all galleries.",
        "Deployment: .htaccess MUST force /dist/ content to avoid source file leakage."
    ],

    // USER MICRO-INSTRUCTIONS
    micro_instructions: [
        "Maintain the 'Sophisticated' and 'Luxury' aesthetic.",
        "Ensure filenames are SEO-friendly.",
        "Always sanitize database inputs.",
        "Keep the 'ComparisonSlider' for AI enhancements.",
        "Respect Guest View Limits (8 items max) in all new gallery implementations.",
        "Ensure Haptic Feedback (Vibration) is present on all swipe actions."
    ],

    // FEATURES THAT ARE LOCKED AND PROTECTED
    locked_features: [
        {
            id: 'haptic_physics_engine',
            name: 'Haptic Physics Engine',
            status: 'stable',
            critical: true,
            description: "1:1 synchronized gesture tracking with cubic-bezier release physics and haptic ticks (10ms/20ms/30ms)."
        },
        {
            id: 'infinite_scroll_engine',
            name: 'High-Performance Infinite Scroll',
            status: 'stable',
            critical: true,
            description: "Pagination system utilizing IntersectionObserver to handle 50,000+ items without DOM overload."
        },
        {
            id: 'sql_indexing_layer',
            name: 'SQL Indexing Layer',
            status: 'stable',
            critical: true,
            description: "Database indexes on category, hidden status, and timestamp to ensure sub-100ms queries at scale."
        },
        {
            id: 'neural_template_engine',
            name: 'Neural Template Engine',
            status: 'stable',
            critical: true,
            description: "Dynamic AI Prompt Templates for Analysis, Enhancement, and Design stored in SQL."
        },
        {
            id: 'server_sharp_engine',
            name: 'Server-Side Image Engine',
            status: 'stable',
            critical: true,
            description: "Node.js Sharp processing for AVIF/WebP generation with CDN optimization."
        },
        {
            id: 'whatsapp_otp',
            name: 'WhatsApp OTP Auth',
            status: 'stable',
            critical: true,
            description: "Authentication via Meta WhatsApp API."
        },
        {
            id: 'ai_comparison_slider',
            name: 'AI Before/After Slider',
            status: 'stable',
            critical: true,
            description: "Visual slider in ProductDetails to compare Original vs Enhanced images."
        },
        {
            id: 'guest_access_control',
            name: 'Guest Access Control',
            status: 'stable',
            critical: true,
            description: "Restricts non-logged users to 8 gallery items and masks sensitive product specs (Weight, Date, Tags)."
        },
        {
            id: 'thumbnail_pipeline',
            name: 'Dual-Stream Image Pipeline',
            status: 'stable',
            critical: true,
            description: "Uploads automatically generate both 1080p (Primary) and 300px (Thumbnail) WebP assets to ensure instant gallery loading."
        }
    ],

    // HISTORY OF STABILIZATION
    fix_log: [
        "Upgraded to v4.3.5: Staff Ops & Auth Upgrade.",
        "Implemented DELETE route for Staff in server.js.",
        "Overhauled Settings.tsx Staff Management to support Add, Edit, Delete, and Password Reset.",
        "Upgraded to v4.3.4: Production Hardening.",
        "Rewrote .htaccess to strictly prioritize /dist/ assets over root source files."
    ]
};
