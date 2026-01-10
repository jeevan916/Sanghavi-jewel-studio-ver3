
/**
 * SANGHAVI JEWEL STUDIO - CORE MEMORY
 * 
 * This file acts as the persistent "Brain" of the application.
 * It documents critical features, architectural decisions, and recent fixes.
 * Future AI agents MUST read this file to understand the project state.
 */

export interface SystemFeature {
    id: string;
    name: string;
    status: 'stable' | 'beta' | 'deprecated';
    critical: boolean; // If true, this feature must NEVER be removed without explicit instruction
    description: string;
}

export interface AppMemory {
    version: string;
    identity: string;
    architecture_rules: string[];
    locked_features: SystemFeature[];
    fix_log: string[];
}

export const APP_MEMORY: AppMemory = {
    version: "3.7.2",
    identity: "Sanghavi Jewel Studio - AI Bespoke PWA",
    
    // STRICT RULES FOR THE AI TO FOLLOW
    architecture_rules: [
        "Project Structure: Flat Root (No 'src' folder).",
        "Use Tailwind CDN for styling in this environment (Preview Mode).",
        "StoreService is the Single Source of Truth for API calls.",
        "Images must follow the pipeline: Fetch -> Base64 -> AI -> Buffer -> Sharp -> CDN.",
        "Always sanitize database inputs (e.g., config.suppliers || []).",
        "Keep the 'ComparisonSlider' for all AI enhancements."
    ],

    // FEATURES THAT MUST NOT BE REMOVED
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
            description: "Node.js Sharp processing for AVIF/WebP generation to replace client-side canvas."
        },
        {
            id: 'whatsapp_otp',
            name: 'WhatsApp OTP Auth',
            status: 'stable',
            critical: true,
            description: "Authentication via Meta WhatsApp API."
        },
        {
            id: 'gemini_native_audio',
            name: 'Gemini Native Audio',
            status: 'beta',
            critical: true,
            description: "Real-time voice consultation using Gemini 2.5 Flash Native Audio."
        }
    ],

    // MEMORY OF RECENT FIXES (To prevent regression)
    fix_log: [
        "Fixed TypeError in Settings.tsx by adding defensive checks (?.map).",
        "Restored Tailwind CDN to fix broken UI/CSS issues.",
        "Implemented 7-step strict AI image pipeline.",
        "Restored ComparisonSlider after it was accidentally removed.",
        "Flattened project structure: Removed 'src/' nesting to fix module resolution errors."
    ]
};
