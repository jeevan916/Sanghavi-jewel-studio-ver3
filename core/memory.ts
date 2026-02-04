
/**
 * SANGHAVI JEWEL STUDIO - CORE MEMORY (THE BRAIN)
 * Version: 4.1.0 (Guest Guard & Privacy Engine)
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
    design_dna: DesignDNA;
    architecture_rules: string[];
    micro_instructions: string[];
    locked_features: SystemFeature[];
    fix_log: string[];
}

export const APP_MEMORY: AppMemory = {
    version: "4.1.0",
    identity: "Sanghavi Jewel Studio - Guest Guard & Privacy Engine",
    
    // THE VISUAL IDENTITY
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
        "Persistence: MySQL (System Settings) + LocalStorage (Session).",
        "AI: Use @google/genai SDK with Flash models for speed."
    ],

    // USER MICRO-INSTRUCTIONS
    micro_instructions: [
        "Maintain the 'Sophisticated' and 'Luxury' aesthetic.",
        "Ensure filenames are SEO-friendly.",
        "Always sanitize database inputs.",
        "Keep the 'ComparisonSlider' for AI enhancements.",
        "Respect Guest View Limits (8 items max) in all new gallery implementations."
    ],

    // FEATURES THAT ARE LOCKED AND PROTECTED
    locked_features: [
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
            id: 'private_visibility_engine',
            name: 'Private Visibility Engine',
            status: 'stable',
            critical: true,
            description: "Admin toggle for Public/Private product status and Tokenized Shared Link generation."
        },
        {
            id: 'dashboard_analytics_split',
            name: 'Split Dashboard Views',
            status: 'stable',
            critical: true,
            description: "Separated 'Activity Log' and 'Trend Analysis' into distinct admin views to reduce cognitive load."
        }
    ],

    // HISTORY OF STABILIZATION
    fix_log: [
        "Upgraded to v4.1.0: Integrated Privacy & Guest logic into Core Memory.",
        "Implemented Guest View Limit (8 items) in Gallery.",
        "Applied Privacy Masks (Blur effects) to Product Details for guests.",
        "Refactored Admin Dashboard: Separated Trends and Activity tabs.",
        "Added 'Make Private' toggle and 'Private Link' generator to Product Details UI.",
        "Restored Admin Dashboard Neural Core visualization.",
        "Fixed Image cropping issue in Product Details (Object-Contain).",
        "Implemented SQL-based System Settings for dynamic AI configuration."
    ]
};
