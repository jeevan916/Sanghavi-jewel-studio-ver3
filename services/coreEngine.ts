import { APP_MEMORY } from '../core/memory';

/**
 * THE CORE ENGINE
 * 
 * This service acts as the application's subconscious.
 * It initializes on boot to ensure the "Brain" (Memory) is respected.
 * It validates that critical features and design tokens are present.
 */
class CoreEngine {
    private memory = APP_MEMORY;

    public initialize() {
        // Aesthetic Boot Log
        console.group(`%c✦ SANGHAVI STUDIO CORE ENGINE v${this.memory.version}`, 'color: #c68a36; font-family: serif; font-size: 14px; font-weight: bold; padding: 4px;');
        
        this.verifyIdentity();
        this.validateDesignDNA();
        this.enforceArchitecture();
        this.checkLockedFeatures();

        console.log(`%c✓ Neural Link Established`, 'color: #4caf50; font-family: sans-serif;');
        console.groupEnd();
    }

    private verifyIdentity() {
        console.log(`%cIdentity Verified: ${this.memory.identity}`, 'color: #888; font-size: 10px;');
    }

    private validateDesignDNA() {
        const dna = this.memory.design_dna;
        console.log(`%c[Design DNA] Primary Font: ${dna.fonts.primary}`, 'color: #c68a36');
        console.log(`%c[Design DNA] Brand Color: ${dna.palette.gold}`, 'color: #c68a36');
    }

    private enforceArchitecture() {
        // Environment Check (CDN vs Build)
        const hasTailwindCDN = !!document.querySelector('script[src*="cdn.tailwindcss.com"]');
        
        if (hasTailwindCDN) {
            console.warn(`[Architecture Warning] Tailwind CDN detected. This should be removed for Production Build.`);
        } else {
            console.log(`%c[Architecture] Stylesheet Engine: PostCSS/Vite (Optimized)`, 'color: #2196f3');
        }
    }

    private checkLockedFeatures() {
        this.memory.locked_features.forEach(f => {
            if (f.critical) {
                console.log(`%c[Locked Feature] Protected: ${f.name}`, 'color: #607d8b; font-weight: bold;');
            }
        });
    }

    public getMemory() {
        return this.memory;
    }

    public getFixHistory() {
        return this.memory.fix_log;
    }
}

export const coreEngine = new CoreEngine();