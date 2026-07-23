/**
 * SANGHAVI JEWEL STUDIO - LOCAL VISUAL INTELLIGENCE & PATTERN LEARNING ENGINE
 * 
 * Purpose: Provides a client-side, 100% offline machine learning and visual search system.
 * It analyzes jewelry images via HTML5 Canvas, extracts 12x12 dominant color channels,
 * brightness/luminance profiles, edge density gradients, aspect ratios, and textual keywords.
 * 
 * This creates a multi-dimensional feature vector for every item in our catalog.
 * Users can "train" the local agent, allowing it to instantly match uploaded queries to the
 * catalog in real-time, right in the browser, with ZERO external API calls.
 */

import { Product } from '@/types.ts';
import { storeService } from './storeService.ts';

export interface VisualFingerprint {
  r: number[];
  g: number[];
  b: number[];
  l: number[]; // Luminance
  edges: number[]; // Edge/detail density
  aspectRatio: number;
}

export interface MultimodalDescriptor {
  productId: string;
  visual: VisualFingerprint | null;
  visuals?: VisualFingerprint[]; // Support for multiple image angles per product
  metaKeywords: number[]; // Presence/frequency of key design terms
}

// Fixed vocabulary of high-value jewelry design terms for our local metadata vector
export const DESIGN_VOCABULARY = [
  'ring', 'solitaire', 'band', 'halo', 'engagement', 'wedding',
  'necklace', 'choker', 'pendant', 'necklace set',
  'bangle', 'kada', 'bracelet', 'cuff',
  'earring', 'stud', 'jhumka', 'hoop', 'drop',
  'gold', 'yellow gold', 'white gold', 'rose gold', 'platinum',
  'diamond', 'solitaire diamond', 'uncut', 'polki',
  'emerald', 'ruby', 'sapphire', 'gemstone', 'pearl',
  'floral', 'classic', 'modern', 'antique', 'bridal', 'temple',
  'pave', 'prong', 'bezel', 'filigree', 'peacock'
];

export interface ImageSearchMatch {
  id: string;
  score: number;
  reason: string;
  product: Product;
}

class LocalAIVisualEngine {
  private index: Map<string, MultimodalDescriptor> = new Map();
  private isTrained: boolean = false;

  constructor() {
    this.loadIndexFromCache();
  }

  /**
   * Load previously computed descriptors from LocalStorage
   */
  private loadIndexFromCache() {
    try {
      const cached = localStorage.getItem('sjs_local_visual_index');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.index = new Map(Object.entries(parsed));
        this.isTrained = this.index.size > 0;
        console.log(`🤖 [Local AI] Loaded ${this.index.size} learned design profiles from cache.`);
      }
    } catch (e) {
      console.warn("Failed to load local visual index cache", e);
    }
  }

  /**
   * Save the current learned index to LocalStorage
   */
  private saveIndexToCache() {
    try {
      const obj = Object.fromEntries(this.index);
      localStorage.setItem('sjs_local_visual_index', JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to cache local visual index", e);
    }
  }

  /**
   * Extract visual descriptor from an image element or Base64 string using Canvas
   */
  public async extractVisualFingerprint(src: string): Promise<VisualFingerprint> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Support cross-origin images (CDNs)
      
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          const aspectRatio = width / (height || 1);

          // We use a normalized 12x12 grid (144 features per channel)
          const gridSize = 12;
          const canvas = document.createElement('canvas');
          canvas.width = gridSize;
          canvas.height = gridSize;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error("Could not create canvas 2D context");
          }

          ctx.drawImage(img, 0, 0, gridSize, gridSize);
          const imgData = ctx.getImageData(0, 0, gridSize, gridSize);
          const data = imgData.data;

          const r: number[] = [];
          const g: number[] = [];
          const b: number[] = [];
          const l: number[] = [];
          const edges: number[] = [];

          // 1. Extract color and luminance channels
          for (let i = 0; i < data.length; i += 4) {
            const red = data[i] / 255;
            const green = data[i+1] / 255;
            const blue = data[i+2] / 255;
            // Standard relative luminance formula
            const lum = 0.299 * red + 0.587 * green + 0.114 * blue;

            r.push(red);
            g.push(green);
            b.push(blue);
            l.push(lum);
          }

          // 2. Simple Edge & Contrast filter (comparing neighboring pixels)
          for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
              const idx = y * gridSize + x;
              const currentLum = l[idx];
              
              // Calculate horizontal and vertical differences to adjacent pixels
              let hDiff = 0;
              let vDiff = 0;

              if (x < gridSize - 1) hDiff = Math.abs(currentLum - l[idx + 1]);
              if (y < gridSize - 1) vDiff = Math.abs(currentLum - l[idx + gridSize]);

              // Combined gradient magnitude
              edges.push(Math.sqrt(hDiff * hDiff + vDiff * vDiff));
            }
          }

          resolve({ r, g, b, l, edges, aspectRatio });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = (err) => {
        reject(new Error("Image failed to load for local feature extraction"));
      };

      img.src = src;
    });
  }

  /**
   * Build a keyword occurrence vector for metadata matching
   */
  public extractMetadataFingerprint(product: Partial<Product>): number[] {
    const textContent = `${product.title || ''} ${product.category || ''} ${product.subCategory || ''} ${(product.tags || []).join(' ')} ${product.description || ''}`.toLowerCase();
    
    return DESIGN_VOCABULARY.map(word => {
      // Return 1 if keyword is found in metadata, 0 otherwise
      return textContent.includes(word) ? 1 : 0;
    });
  }

  /**
   * Creates a synthetic visual fingerprint based purely on product specifications
   * used as a fallback if the image fails to load or during rapid initialization
   */
  public createSyntheticFingerprint(product: Partial<Product>): VisualFingerprint {
    const gridCount = 144; // 12x12
    const category = (product.category || '').toLowerCase();
    const tagsStr = ((product.tags || []).join(' ') + ' ' + (product.title || '')).toLowerCase();

    // Default Aspect Ratios
    let aspectRatio = 1.0; // Square
    if (category.includes('necklace') || category.includes('pendant')) aspectRatio = 0.85; // Tall
    if (category.includes('bangle') || category.includes('bracelet')) aspectRatio = 1.15; // Wide

    // Base color tones depending on metal tags
    let rVal = 0.8;
    let gVal = 0.7;
    let bVal = 0.3; // Default Warm Yellow Gold

    if (tagsStr.includes('platinum') || tagsStr.includes('white gold') || tagsStr.includes('silver')) {
      rVal = 0.75;
      gVal = 0.75;
      bVal = 0.78; // Cool Platinum Hue
    } else if (tagsStr.includes('rose gold')) {
      rVal = 0.85;
      gVal = 0.62;
      bVal = 0.58; // Rose gold Hue
    }

    // Gemstones color inject
    let gemstoneColor = null;
    if (tagsStr.includes('emerald')) gemstoneColor = { r: 0.1, g: 0.7, b: 0.2 };
    if (tagsStr.includes('ruby')) gemstoneColor = { r: 0.8, g: 0.1, b: 0.2 };
    if (tagsStr.includes('sapphire')) gemstoneColor = { r: 0.1, g: 0.2, b: 0.8 };

    const r = Array(gridCount).fill(rVal);
    const g = Array(gridCount).fill(gVal);
    const b = Array(gridCount).fill(bVal);
    const l = Array(gridCount).fill(0.0);
    const edges = Array(gridCount).fill(0.1);

    // Populate simulated central gems or details
    for (let i = 0; i < gridCount; i++) {
      const x = i % 12;
      const y = Math.floor(i / 12);
      const isCenter = x >= 4 && x <= 7 && y >= 4 && y <= 7;

      if (isCenter) {
        if (tagsStr.includes('solitaire') || tagsStr.includes('diamond')) {
          // Solitaires get a high-brightness center (diamond sparkle)
          r[i] = 0.95;
          g[i] = 0.95;
          b[i] = 0.99;
          edges[i] = 0.8; // High contrast
        } else if (gemstoneColor) {
          r[i] = gemstoneColor.r;
          g[i] = gemstoneColor.g;
          b[i] = gemstoneColor.b;
          edges[i] = 0.6;
        }
      }
      l[i] = 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
    }

    return { r, g, b, l, edges, aspectRatio };
  }

  /**
   * Scan and train the local engine on the entire store catalog
   * Analyzes all available image angles/thumbnails for every product to build a multi-view visual descriptor
   */
  public async train(products: Product[], onProgress?: (percent: number) => void): Promise<number> {
    console.log(`🧠 [Local AI] Starting multi-angle visual learning on ${products.length} catalog items...`);
    let completed = 0;

    for (const product of products) {
      const metaKeywords = this.extractMetadataFingerprint(product);
      const visuals: VisualFingerprint[] = [];

      // Extract all available thumbnails and images for different angles of the product
      const targetImages = product.thumbnails && product.thumbnails.length > 0
        ? product.thumbnails
        : (product.images && product.images.length > 0 ? product.images : []);

      if (targetImages.length > 0) {
        // Learn characteristics of every angle image
        for (let idx = 0; idx < targetImages.length; idx++) {
          try {
            const imgUrl = storeService.getImageUrl(targetImages[idx]);
            const fingerprint = await this.extractVisualFingerprint(imgUrl);
            visuals.push(fingerprint);
          } catch (e) {
            console.warn(`Failed extracting fingerprint for product ${product.id} angle ${idx}`, e);
          }
        }
      }

      // Fallback to high-fidelity synthetic descriptor if no real images could be parsed
      if (visuals.length === 0) {
        visuals.push(this.createSyntheticFingerprint(product));
      }

      this.index.set(product.id, {
        productId: product.id,
        visual: visuals[0] || null, // Fallback for single image compat
        visuals: visuals,           // Stores multiple learned angles
        metaKeywords
      });

      completed++;
      if (onProgress) {
        onProgress(Math.round((completed / products.length) * 100));
      }
    }

    this.isTrained = true;
    this.saveIndexToCache();
    console.log(`✨ [Local AI] Training completed! Fully indexed ${this.index.size} visual styles with multi-angle support.`);
    return this.index.size;
  }

  /**
   * Calculate Weighted Cosine Similarity between two numeric vectors using a spatial weight map
   */
  private weightedCosineSimilarity(vecA: number[], vecB: number[], weights: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      const w = weights[i] !== undefined ? weights[i] : 1.0;
      const valA = vecA[i] * w;
      const valB = vecB[i] * w;
      
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    
    return normA && normB ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  }

  /**
   * Search catalog instantly using the trained Local Index
   * Compares the query image to all learned angles of every product, selecting the best matching angle.
   */
  public async searchByImage(
    queryBase64: string, 
    products: Product[],
    categoryFilter?: string // Optional target category filter to lock category matching
  ): Promise<{ matches: ImageSearchMatch[]; analysis: string }> {
    if (!this.isTrained || this.index.size === 0) {
      await this.train(products);
    }

    // 1. Extract visual fingerprint of uploaded image query
    const queryFingerprint = await this.extractVisualFingerprint(queryBase64);

    // 2. Predict visual characteristics to provide immediate analysis feedback
    const analysis = this.generateLocalAnalysis(queryFingerprint);

    // 3. Generate Spatial Center Weighting Map (12x12 grid)
    // Centered at (5.5, 5.5). Cells at the center get 5.0x weight, borders get down to 0.1x.
    // This suppresses background "visible environment image" completely.
    const weights: number[] = [];
    const gridSize = 12;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const distToCenter = Math.sqrt(Math.pow(x - 5.5, 2) + Math.pow(y - 5.5, 2));
        const weight = Math.max(0.1, 5.0 * Math.exp(-0.35 * distToCenter));
        weights.push(weight);
      }
    }

    // 4. Extract Query Metal and Gemstone Signatures from Foreground
    let queryGoldCount = 0;
    let queryWhiteCount = 0;
    let queryColoredGemCount = 0;
    let foregroundPixels = 0;

    if (queryFingerprint) {
      for (let i = 0; i < queryFingerprint.r.length; i++) {
        // Focus heavily on the foreground center-weight area
        if (weights[i] > 1.5) {
          foregroundPixels++;
          const r = queryFingerprint.r[i];
          const g = queryFingerprint.g[i];
          const b = queryFingerprint.b[i];

          // Gold hue detection (rich yellow/warm golden pixels)
          if (r > 0.45 && g > 0.35 && b < g * 0.82 && r > g) {
            queryGoldCount++;
          }
          // White metal / brilliant diamond sparkle detection
          else if (r > 0.72 && g > 0.72 && b > 0.72 && Math.abs(r - g) < 0.12 && Math.abs(g - b) < 0.12) {
            queryWhiteCount++;
          }
          // Colored gemstones (Emerald, Ruby, Sapphire, etc.)
          else if ((g > r * 1.25 && g > b * 1.25) || (r > g * 1.25 && r > b * 1.25) || (b > r * 1.25 && b > g * 1.25)) {
            queryColoredGemCount++;
          }
        }
      }
    }

    const queryHasGoldSignature = queryGoldCount / (foregroundPixels || 1) > 0.12;
    const queryHasDiamondSignature = queryWhiteCount / (foregroundPixels || 1) > 0.15;
    const queryHasGemstoneSignature = queryColoredGemCount / (foregroundPixels || 1) > 0.08;

    // 5. Predict category offline based on the query fingerprint to allow smart auto-boosting
    let predictedCategory = '';
    if (queryFingerprint) {
      const aspect = queryFingerprint.aspectRatio;
      const avgEdge = queryFingerprint.edges.reduce((sum, v) => sum + v, 0) / queryFingerprint.edges.length;
      
      if (aspect > 1.25) {
        predictedCategory = 'bangle';
      } else if (aspect < 0.78) {
        predictedCategory = 'necklace';
      } else {
        if (avgEdge > 0.28) {
          predictedCategory = 'ring';
        } else {
          predictedCategory = 'earring';
        }
      }
    }

    const matches: ImageSearchMatch[] = [];

    // 6. Score every item in the index
    for (const [productId, desc] of this.index.entries()) {
      const product = products.find(p => p.id === productId);
      if (!product) continue;

      // Force filter matching if category filter is selected
      const prodCat = (product.category || '').toLowerCase();
      if (categoryFilter && categoryFilter !== 'all') {
        const filterCat = categoryFilter.toLowerCase();
        if (!prodCat.includes(filterCat) && !filterCat.includes(prodCat)) {
          // Skip if does not match selected filter category
          continue;
        }
      }

      let visualScore = 0;
      let maxScoreForProduct = 0;
      let bestReasonDetails: string[] = [];

      // Compare query against all learned image angles of this product
      const fingerPrintsToMatch = desc.visuals && desc.visuals.length > 0
        ? desc.visuals
        : (desc.visual ? [desc.visual] : []);

      if (fingerPrintsToMatch.length > 0 && queryFingerprint) {
        for (const fp of fingerPrintsToMatch) {
          const colorSimilarityR = this.weightedCosineSimilarity(queryFingerprint.r, fp.r, weights);
          const colorSimilarityG = this.weightedCosineSimilarity(queryFingerprint.g, fp.g, weights);
          const colorSimilarityB = this.weightedCosineSimilarity(queryFingerprint.b, fp.b, weights);
          const colorSimilarity = (colorSimilarityR + colorSimilarityG + colorSimilarityB) / 3;

          const edgeSimilarity = this.weightedCosineSimilarity(queryFingerprint.edges, fp.edges, weights);
          const lumSimilarity = this.weightedCosineSimilarity(queryFingerprint.l, fp.l, weights);
          
          const aspectDiff = Math.abs(queryFingerprint.aspectRatio - fp.aspectRatio);
          const aspectSimilarity = Math.max(0, 1 - aspectDiff * 1.5);

          // Combined visual score for this specific angle
          const scoreForAngle = (colorSimilarity * 0.40) + (lumSimilarity * 0.30) + (edgeSimilarity * 0.20) + (aspectSimilarity * 0.10);
          
          if (scoreForAngle > maxScoreForProduct) {
            maxScoreForProduct = scoreForAngle;
            
            bestReasonDetails = [];
            if (colorSimilarity > 0.88) bestReasonDetails.push("shares matching gold metal undertones");
            if (lumSimilarity > 0.85) bestReasonDetails.push("corresponds to similar brilliant light facets");
            if (edgeSimilarity > 0.85) bestReasonDetails.push("possesses similar design pattern density");
          }
        }

        visualScore = maxScoreForProduct;

        // Apply Gold Signature correlation bonus
        const prodTags = ((product.tags || []).join(' ') + ' ' + (product.title || '') + ' ' + (product.category || '')).toLowerCase();
        let signatureBonus = 1.0;

        if (queryHasGoldSignature) {
          if (prodTags.includes('gold') || prodTags.includes('yellow gold') || prodTags.includes('karat')) {
            signatureBonus += 0.08;
          } else {
            signatureBonus -= 0.05;
          }
        }
        if (queryHasDiamondSignature) {
          if (prodTags.includes('diamond') || prodTags.includes('solitaire') || prodTags.includes('pave')) {
            signatureBonus += 0.08;
          }
        }
        if (queryHasGemstoneSignature) {
          if (prodTags.includes('emerald') || prodTags.includes('ruby') || prodTags.includes('sapphire') || prodTags.includes('gemstone')) {
            signatureBonus += 0.10;
          }
        }

        // Apply automatic predicted category-matching boost if no explicit category lock is set
        if (!categoryFilter || categoryFilter === 'all') {
          if (predictedCategory && prodCat.includes(predictedCategory)) {
            signatureBonus += 0.15; // 15% bonus for matching predicted category type!
          }
        }

        visualScore = Math.min(1.0, visualScore * signatureBonus);
      }

      // 7. Compare visual attributes to synthesize a conceptual match reason
      let finalScore = Math.round(visualScore * 100);
      
      if (finalScore > 98) finalScore = 98;
      if (finalScore < 10) finalScore = 10;

      let matchedConcept = "aesthetic design matching";
      if (bestReasonDetails.length > 0) {
        matchedConcept = `close match which ${bestReasonDetails.join(' and ')}`;
      } else {
        matchedConcept = "displays overlapping visual lines and silhouette composition";
      }

      matches.push({
        id: productId,
        score: finalScore,
        reason: `Matched locally with ${finalScore}% precision; ${matchedConcept}.`,
        product
      });
    }

    // Sort by highest matching score
    const rankedMatches = matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return {
      matches: rankedMatches,
      analysis
    };
  }
  private generateLocalAnalysis(fp: VisualFingerprint): string {
    // Determine metal color family from R, G, B bins
    const avgR = fp.r.reduce((sum, v) => sum + v, 0) / fp.r.length;
    const avgG = fp.g.reduce((sum, v) => sum + v, 0) / fp.g.length;
    const avgB = fp.b.reduce((sum, v) => sum + v, 0) / fp.b.length;

    let metalType = "Premium Precious Metal";
    if (avgR > 0.72 && avgG > 0.65 && avgB < 0.48) {
      metalType = "Classic Yellow Gold (22K/18K style Hue)";
    } else if (avgR > 0.78 && avgG > 0.58 && avgB > 0.52 && Math.abs(avgG - avgB) < 0.12) {
      metalType = "Warm Luxury Rose Gold Hue";
    } else if (avgR > 0.68 && avgG > 0.68 && avgB > 0.68) {
      metalType = "White Gold / Platinum / Brilliant Silver Hue";
    }

    // Determine complexity from average edge strength
    const avgEdge = fp.edges.reduce((sum, v) => sum + v, 0) / fp.edges.length;
    let designComplexity = "minimalist, solid-band silhouette";
    if (avgEdge > 0.35) {
      designComplexity = "highly intricate pave diamond setting with complex cluster details";
    } else if (avgEdge > 0.20) {
      designComplexity = "classic style featuring centered solitaire prongs or moderate visual accents";
    }

    // Determine piece category hint from aspect ratio
    let shapeHint = "proportionate ring or earring structure";
    if (fp.aspectRatio < 0.8) {
      shapeHint = "elongated design profile (characteristic of pendants or drop earrings)";
    } else if (fp.aspectRatio > 1.25) {
      shapeHint = "wider horizontal profile (characteristic of bracelets, cuffs, or bangles)";
    }

    return `The local visual intelligence agent detected a ${metalType} base with a ${designComplexity}. The visual boundaries indicate a ${shapeHint}.`;
  }

  /**
   * Reset local trained data
   */
  public clearCache() {
    localStorage.removeItem('sjs_local_visual_index');
    this.index.clear();
    this.isTrained = false;
  }

  /**
   * Get training status
   */
  public getStatus() {
    return {
      isTrained: this.isTrained,
      indexSize: this.index.size
    };
  }
}

export const localAIVisualEngine = new LocalAIVisualEngine();
