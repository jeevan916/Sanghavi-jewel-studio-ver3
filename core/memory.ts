
/**
 * SANGHAVI JEWEL STUDIO - CORE MEMORY (THE BRAIN)
 * 
 * This file is the central intelligence of the application.
 * It documents the "Design DNA", "Critical Features", and "Micro-Instructions"
 * that define the application's identity and behavior.
 * 
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
        gold: string;      // #c68a36 (Primary Brand Color)
        background: string;// #fbf8f1 (Warm Stone)
        surface: string;   // #ffffff
    };
    aesthetics: {
        radius: string;    // 'rounded-xl' or 'rounded-2xl'
        animation: string; // 'animate-fade-in'
    };
}

export interface AppMemory {
    version: string;
    identity: string;
    design_dna: DesignDNA;       // The visual soul of the app
    architecture_rules: string[];// Technical commandments
    micro_instructions: string[];// Specific user preferences/fixes
    locked_features: SystemFeature[];
    fix_log: string[];
}

export const APP_MEMORY: AppMemory = {
    version: "3.9.4",
    identity: "Sanghavi Jewel Studio - AI Bespoke PWA",
    
    // THE VISUAL IDENTITY (DO NOT BREAK)
    design_dna: {
        fonts: {
            primary: "Playfair Display",
            secondary: "Inter"
        },
        palette: {
            gold: "#c68a36",
            background: "#fbf8f1",
            surface: "#ffffff"
        },
        aesthetics: {
            radius: "rounded-2xl",
            animation: "animate-fade-in"
        }
    },

    // TECHNICAL RULES
    architecture_rules: [
        "Project Structure: Flat Root (No 'src' folder nesting).",
        "Styling: PostCSS/Vite Build (No Runtime CDN).",
        "API Logic: 'storeService' is the Single Source of Truth.",
        "Images: Pipeline -> Slugify -> Base64 -> AI -> Buffer -> Sharp -> CDN.",
        "Persistence: MySQL + LocalStorage (User Session)."
    ],

    // USER MICRO-INSTRUCTIONS (Persistent Requests)
    micro_instructions: [
        "Use ONLY Cheapest/Fastest AI Models (Flash Series) for all tasks.",
        "Remove all AI Vendor Branding (e.g. 'Powered by Gemini').",
        "Maintain the 'Sophisticated' and 'Luxury' aesthetic.",
        "Ensure filenames are SEO-friendly and lowercase for Hostinger compatibility.",
        "Always sanitize database inputs.",
        "Keep the 'ComparisonSlider' for AI enhancements."
    ],

    // FEATURES THAT ARE LOCKED AND PROTECTED
    locked_features: [
        {
            id: 'ai_comparison_slider',
            name: 'AI Before/After Slider',
            status: 'stable',
            critical: true,
            description: "Visual slider in ProductDetails to compare Original vs Enhanced images."
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
        }
    ],

    // HISTORY OF STABILIZATION
    fix_log: [
        "Reverted to PostCSS/Vite build for Tailwind CSS (Removed CDN) to fix build-time integration.",
        "Implemented SEO-friendly file naming (slugified) to optimize for Hostinger CDN.",
        "Added explicit MIME type handling in .htaccess for WebP/AVIF formats.",
        "Removed Gemini Voice/Audio features and microphone permissions.",
        "Enforced 'Flash' series models for all AI tasks to optimize speed/cost."
    ]
};
