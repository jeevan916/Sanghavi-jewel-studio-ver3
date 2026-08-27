import fs, { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PERSISTENCE_DIR = path.resolve(__dirname, '..', '..', 'sanghavi_persistence');
const PRIMARY_CACHE_FILE = path.join(DATA_DIR, 'curated_overview.json');
const PERSISTENT_CACHE_FILE = path.join(PERSISTENCE_DIR, 'curated_overview.json');

const ensureDirectoryExistence = (filePath) => {
    const dirname = path.dirname(filePath);
    if (!existsSync(dirname)) {
        try {
            mkdirSync(dirname, { recursive: true });
        } catch (e) {
            // Ignore directory creation errors
        }
    }
};

/**
 * Executes the full Curated Overview calculations (Latest, Loved/Most Sold, Trending, Ideal, Parameters)
 * and updates both in-memory cache and disk persistence snapshots.
 */
export async function calculateCuratedOverview(pool, sanitizeProduct, CACHE) {
    const startTime = Date.now();
    console.log('[Curated Service] 🔄 Starting 03:00 AM Curated Overview server-side calculation...');

    try {
        let latestRows = [];
        let lovedRows = [];
        let trendingRows = [];
        let idealRows = [];

        // Check if database connection pool is active
        if (pool) {
            try {
                // 1. Latest Arrivals (New Items)
                const [latest] = await pool.query(`
                    SELECT * FROM products 
                    WHERE isHidden = 0 
                    ORDER BY createdAt DESC 
                    LIMIT 12
                `);
                latestRows = latest;

                // 2. Best Sellers & Most Sold / Loved
                const [loved] = await pool.query(`
                    SELECT p.*, 
                    (
                        (SELECT COUNT(*) FROM analytics a WHERE a.productId = p.id AND a.type = 'sold') * 10 +
                        (SELECT COUNT(*) FROM analytics a WHERE a.productId = p.id AND a.type = 'inquiry') * 5 +
                        (SELECT COUNT(*) FROM analytics a WHERE a.productId = p.id AND a.type = 'like') * 3
                    ) as popularityScore 
                    FROM products p 
                    WHERE p.isHidden = 0 
                    ORDER BY popularityScore DESC, p.createdAt DESC 
                    LIMIT 12
                `);
                lovedRows = loved;

                // 3. Trending Now (Calculated over last 30 days)
                const [trending] = await pool.query(`
                    SELECT p.*, 
                    (SELECT COALESCE(SUM(
                        CASE 
                            WHEN a.type = 'inquiry' THEN 5 
                            WHEN a.type = 'sold' THEN 10
                            WHEN a.type = 'like' THEN 3
                            WHEN a.type = 'view' THEN 1
                            ELSE 0 
                        END
                    ), 0) FROM analytics a WHERE a.productId = p.id AND a.timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)) as activityScore 
                    FROM products p 
                    WHERE p.isHidden = 0 
                    ORDER BY activityScore DESC, p.createdAt DESC 
                    LIMIT 12
                `);
                trendingRows = trending;

                // 4. Ideal (Classic / Timeless selection)
                const [ideal] = await pool.query(`
                    SELECT * FROM products 
                    WHERE isHidden = 0 
                    ORDER BY createdAt ASC 
                    LIMIT 20
                `);
                idealRows = ideal;
            } catch (dbErr) {
                console.warn('[Curated Service] Database query warning, falling back to disk cache or demo:', dbErr.message);
            }
        }

        // Fallback to demo items if database is empty or down
        if (latestRows.length === 0) {
            const demoPath = path.join(DATA_DIR, 'demo_products.json');
            if (existsSync(demoPath)) {
                try {
                    const demoData = JSON.parse(readFileSync(demoPath, 'utf8'));
                    latestRows = demoData;
                    lovedRows = demoData;
                    trendingRows = demoData;
                    idealRows = demoData;
                } catch (e) {
                    console.error('[Curated Service] Error parsing demo data:', e);
                }
            }
        }

        const sanitizedLatest = latestRows.map(sanitizeProduct).filter(Boolean);
        const sanitizedLoved = lovedRows.map(sanitizeProduct).filter(Boolean);
        const sanitizedTrending = trendingRows.map(sanitizeProduct).filter(Boolean);
        const shuffledIdeal = idealRows.sort(() => 0.5 - Math.random()).slice(0, 4).map(sanitizeProduct).filter(Boolean);

        const durationMs = Date.now() - startTime;
        const curatedData = {
            latest: sanitizedLatest,
            loved: sanitizedLoved,
            trending: sanitizedTrending,
            ideal: shuffledIdeal,
            meta: {
                calculatedAt: new Date().toISOString(),
                calculationTimeMs: durationMs,
                schedule: '03:00 AM Daily',
                totalLatest: sanitizedLatest.length,
                totalLoved: sanitizedLoved.length,
                totalTrending: sanitizedTrending.length,
                status: 'ready'
            }
        };

        // Update in-memory cache
        if (CACHE && CACHE.curated) {
            CACHE.curated.data = curatedData;
            CACHE.curated.lastFetch = Date.now();
        }

        // Persist to disk
        try {
            ensureDirectoryExistence(PRIMARY_CACHE_FILE);
            writeFileSync(PRIMARY_CACHE_FILE, JSON.stringify(curatedData, null, 2), 'utf8');
            
            if (existsSync(PERSISTENCE_DIR)) {
                ensureDirectoryExistence(PERSISTENT_CACHE_FILE);
                writeFileSync(PERSISTENT_CACHE_FILE, JSON.stringify(curatedData, null, 2), 'utf8');
            }
            console.log(`[Curated Service] ✅ Curated overview snapshot saved to disk (${durationMs}ms)`);
        } catch (fsErr) {
            console.warn('[Curated Service] Could not write snapshot to disk:', fsErr.message);
        }

        return curatedData;
    } catch (err) {
        console.error('[Curated Service] ❌ Failed to calculate curated overview:', err);
        return null;
    }
}

/**
 * Returns the pre-calculated Curated Overview data in 0ms without hitting heavy DB subqueries.
 */
export function getCuratedOverview(CACHE) {
    // 1. Check Memory Cache
    if (CACHE && CACHE.curated && CACHE.curated.data) {
        return CACHE.curated.data;
    }

    // 2. Check Disk Cache
    const candidateFiles = [PERSISTENT_CACHE_FILE, PRIMARY_CACHE_FILE];
    for (const filePath of candidateFiles) {
        if (existsSync(filePath)) {
            try {
                const raw = readFileSync(filePath, 'utf8');
                const data = JSON.parse(raw);
                if (data && data.latest) {
                    if (CACHE && CACHE.curated) {
                        CACHE.curated.data = data;
                        CACHE.curated.lastFetch = Date.now();
                    }
                    return data;
                }
            } catch (e) {
                // Continue to next candidate
            }
        }
    }

    return null;
}

/**
 * Initializes the 03:00 AM Cron Scheduler and warms up cache on server startup.
 */
export function initCuratedScheduler(pool, sanitizeProduct, CACHE) {
    // 1. Warm up from disk on server start
    const existingData = getCuratedOverview(CACHE);
    if (existingData) {
        console.log(`[Curated Service] 🚀 Loaded warm Curated Overview snapshot from disk (Calculated: ${existingData.meta?.calculatedAt || 'N/A'})`);
    }

    // 2. If no data exists on disk, run background initial computation
    setTimeout(() => {
        if (!CACHE || !CACHE.curated || !CACHE.curated.data) {
            console.log('[Curated Service] No cached snapshot found on startup. Generating initial overview snapshot in background...');
            calculateCuratedOverview(pool, sanitizeProduct, CACHE).catch(e => {
                console.warn('[Curated Service] Initial overview calculation failed:', e.message);
            });
        }
    }, 2000);

    // 3. Register Daily 3:00 AM Cron Job ('0 3 * * *')
    cron.schedule('0 3 * * *', async () => {
        console.log('[Curated Service] ⏰ [03:00 AM CRON] Triggering scheduled Curated Overview pre-calculation...');
        try {
            await calculateCuratedOverview(pool, sanitizeProduct, CACHE);
            console.log('[Curated Service] ⏰ [03:00 AM CRON] Curated Overview calculation completed successfully.');
        } catch (e) {
            console.error('[Curated Service] ❌ Scheduled 3:00 AM calculation failed:', e);
        }
    });

    console.log('[Curated Service] ⏰ Scheduled Daily Curated Overview pre-calculation at 03:00 AM');
}
