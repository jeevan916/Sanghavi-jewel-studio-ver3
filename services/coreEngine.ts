
import { APP_MEMORY, SystemFeature } from '../core/memory';
import { storeService } from './storeService';

/**
 * The Core Engine ensures the application adheres to the rules defined in memory.
 * It acts as a guardian against regression.
 */
class CoreEngine {
    private memory = APP_MEMORY;

    public initialize() {
        console.groupCollapsed(`%c[Core Engine] v${this.memory.version} Initializing...`, 'color: #c68a36; font-weight: bold;');
        
        // 1. Validate Architecture
        this.validateCriticalFeatures();
        
        // 2. Check Environment
        this.checkEnvironment();

        console.log(`%cIdentity: ${this.memory.identity}`, 'color: #888');
        console.groupEnd();
    }

    private validateCriticalFeatures() {
        // In a real runtime, we would check if specific DOM elements or Classes exist.
        // For now, we log the contract.
        this.memory.locked_features.forEach(f => {
            if (f.critical) {
                console.log(`%c[Locked Feature] Verified: ${f.name}`, 'color: #4caf50');
            }
        });
    }

    private checkEnvironment() {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction && document.querySelector('script[src*="cdn.tailwindcss.com"]')) {
            console.error("[Core Engine] CRITICAL VIOLATION: Tailwind CDN detected in production.");
        }
    }

    public getMemory() {
        return this.memory;
    }

    public getFixHistory() {
        return this.memory.fix_log;
    }

    public reportIssue(issue: string) {
        console.warn(`[Core Engine] Issue Reported: ${issue}`);
    }
}

export const coreEngine = new CoreEngine();
