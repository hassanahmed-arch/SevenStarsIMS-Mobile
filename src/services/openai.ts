// src/services/openai.ts
import OpenAI from 'openai';
import { supabase } from '../lib/supabase';

// Store this in environment variables in production
const OPENAI_API_KEY = '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';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

export interface ParsedOrderItem {
    product_name: string;
    quantity: number;
    unit: string;
    price?: number;
    confidence: 'high' | 'medium' | 'low';
    original_text?: string;
    possible_variations?: string[];
}

export interface MatchedProduct {
    original_text: string;
    matched_product?: any;
    product_name: string;
    product_id?: string;
    sku?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    confidence: 'high' | 'medium' | 'low' | 'no_match';
    in_stock: boolean;
    current_stock?: number;
    stock_status?: string;
    ai_suggestions?: string[];
}

/**
 * Process natural language order with OpenAI GPT-4
 */
export async function processOrderWithAI(naturalLanguageOrder: string): Promise<ParsedOrderItem[]> {
    try {
        const systemPrompt = `You are an expert order processing assistant for a wholesale company specializing in tobacco products, hookah supplies, and related accessories. 
    
    Your task is to parse natural language orders and extract product information with high accuracy.
    
    Key product categories to recognize:
    1. Tobacco Products:
       - Al Fakher, Fakher (common variations: alfakher, al-fakher)
       - Adalya
       - Starbuzz, Star Buzz
       - Fumari
       - Tangiers
       - Common flavors: watermelon, mint, grape, double apple, blueberry, etc.
    
    2. Coals:
       - Coconut coals, coco coals, natural coals
       - Quick light coals, quicklights
       - Brands: Titanium, CocoNara, CocoUrth
    
    3. Accessories:
       - Hoses, pipes, tubes
       - Bowls, heads
       - Tips, mouth tips, filters
       - Foil, screens
       - Tongs, wind covers
    
    4. Units to recognize:
       - case, cases (typically 4-12 units)
       - box, boxes (varies by product)
       - pack, packs
       - carton, cartons
       - piece, pieces, pcs
       - bottle, bottles
       - kg, kilogram
       - lb, pound
    
    Return a JSON object with an "items" array containing:
    {
      "items": [
        {
          "product_name": "string - cleaned product name",
          "quantity": number,
          "unit": "string - singular form of unit",
          "price": number or null,
          "confidence": "high|medium|low",
          "original_text": "string - original text segment",
          "possible_variations": ["array of possible product name variations"]
        }
      ]
    }
    
    Guidelines:
    - Extract flavor names when mentioned with tobacco products
    - Recognize common abbreviations and misspellings
    - Set confidence to "high" for clear matches, "medium" for probable matches, "low" for unclear items
    - Include possible_variations for products that might have multiple names in inventory
    - Clean up the product name but preserve important details like flavor, size, or brand`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Parse this order: "${naturalLanguageOrder}"` }
            ],
            temperature: 0.2, // Lower temperature for more consistent parsing
            max_tokens: 1000,
            response_format: { type: "json_object" }
        });

        const response = completion.choices[0].message.content;
        if (!response) throw new Error('No response from AI');

        const parsed = JSON.parse(response);
        return parsed.items || [];

    } catch (error) {
        console.error('Error processing with OpenAI:', error);
        // Fallback to enhanced local processing
        return processOrderLocallyEnhanced(naturalLanguageOrder);
    }
}

/**
 * Enhanced local processing with better pattern matching
 */
function processOrderLocallyEnhanced(naturalLanguageOrder: string): ParsedOrderItem[] {
    const items: ParsedOrderItem[] = [];

    // Split by common delimiters
    const lines = naturalLanguageOrder.split(/[,;\n]+/);

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Enhanced quantity extraction
        const quantityPatterns = [
            /(\d+)\s*(cases?|boxes?|packs?|pieces?|pcs?|cartons?|bottles?|kgs?|lbs?|units?)/i,
            /(\d+)\s+(?:of\s+)?(.+)/i, // Fallback for "10 watermelon fakher"
        ];

        let quantity = 1;
        let unit = 'piece';
        let productName = trimmedLine;

        for (const pattern of quantityPatterns) {
            const match = trimmedLine.match(pattern);
            if (match) {
                quantity = parseInt(match[1]) || 1;
                if (match[2] && /^(cases?|boxes?|packs?|pieces?|pcs?|cartons?|bottles?|kgs?|lbs?|units?)$/i.test(match[2])) {
                    unit = match[2].replace(/s$/, '').toLowerCase();
                    productName = trimmedLine.replace(match[0], '').trim();
                } else {
                    productName = match[2] || trimmedLine;
                }
                break;
            }
        }

        // Extract price
        const priceMatch = productName.match(/(?:\$|at\s*|@\s*)\s*(\d+(?:\.\d{2})?)\s*(?:each|per|ea)?/i);
        const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;

        if (priceMatch) {
            productName = productName.replace(priceMatch[0], '').trim();
        }

        // Clean up product name
        productName = productName
            .replace(/^\s*of\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (productName) {
            // Generate possible variations
            const variations = generateProductVariations(productName);

            // Determine confidence
            let confidence: 'high' | 'medium' | 'low' = 'medium';
            if (quantity > 0 && productName.length > 3 && unit !== 'piece') {
                confidence = 'high';
            } else if (productName.length <= 3 || !quantityPatterns[0].test(trimmedLine)) {
                confidence = 'low';
            }

            items.push({
                product_name: productName,
                quantity,
                unit,
                price,
                confidence,
                original_text: line.trim(),
                possible_variations: variations,
            });
        }
    }

    return items;
}

/**
 * Generate product name variations for better matching
 */
function generateProductVariations(productName: string): string[] {
    const variations = new Set<string>([productName]);
    const words = productName.toLowerCase().split(' ');

    // Common replacements and variations
    const replacements: { [key: string]: string[] } = {
        'fakher': ['al fakher', 'alfakher', 'al-fakher', 'al fakher tobacco'],
        'al': ['al fakher', 'al waha', 'al-'],
        'adalya': ['adalya tobacco', 'adalya shisha'],
        'starbuzz': ['star buzz', 'starbuzz tobacco'],
        'coconut': ['coco', 'natural', 'coconara'],
        'coals': ['coal', 'charcoal', 'charcoals'],
        'quicklight': ['quick light', 'quick-light', 'ql'],
        'tips': ['tip', 'mouth tips', 'mouth pieces', 'filters'],
        'hose': ['hoses', 'pipe', 'tubes'],
        'bowl': ['bowls', 'head', 'heads'],
    };

    // Generate variations based on word replacements
    words.forEach((word, index) => {
        if (replacements[word]) {
            replacements[word].forEach(replacement => {
                const newWords = [...words];
                newWords[index] = replacement;
                variations.add(newWords.join(' '));
            });
        }
    });

    // Add variations with common suffixes/prefixes
    if (productName.toLowerCase().includes('tobacco') === false &&
        (productName.toLowerCase().includes('fakher') ||
            productName.toLowerCase().includes('adalya') ||
            productName.toLowerCase().includes('starbuzz'))) {
        variations.add(`${productName} tobacco`);
        variations.add(`${productName} shisha`);
    }

    // Add flavor combinations
    const flavors = ['watermelon', 'mint', 'grape', 'apple', 'blueberry', 'mango', 'peach', 'lemon'];
    const brands = ['fakher', 'adalya', 'starbuzz', 'fumari'];

    flavors.forEach(flavor => {
        if (productName.toLowerCase().includes(flavor)) {
            brands.forEach(brand => {
                if (productName.toLowerCase().includes(brand)) {
                    variations.add(`${brand} ${flavor}`);
                    variations.add(`${flavor} ${brand}`);
                }
            });
        }
    });

    return Array.from(variations).slice(0, 10); // Limit to 10 variations
}

/**
 * Match parsed items with inventory using AI-enhanced matching
 */
export async function matchWithInventory(
    parsedItems: ParsedOrderItem[],
    supabaseClient: any = supabase
): Promise<MatchedProduct[]> {
    const matchedItems: MatchedProduct[] = [];

    // Fetch all products for better matching
    const { data: allProducts } = await supabaseClient
        .from('products')
        .select('*')
        .eq('is_active', true);

    for (const item of parsedItems) {
        try {
            // Try multiple matching strategies
            let bestMatch = null;
            let matchConfidence: 'high' | 'medium' | 'low' | 'no_match' = 'no_match';
            let suggestions: string[] = [];

            // Strategy 1: Exact match
            bestMatch = findExactMatch(item.product_name, allProducts);
            if (bestMatch) {
                matchConfidence = 'high';
            }

            // Strategy 2: Try variations if no exact match
            if (!bestMatch && item.possible_variations) {
                for (const variation of item.possible_variations) {
                    bestMatch = findExactMatch(variation, allProducts);
                    if (bestMatch) {
                        matchConfidence = 'medium';
                        break;
                    }
                }
            }

            // Strategy 3: Fuzzy matching with AI selection
            if (!bestMatch) {
                const fuzzyMatches = findFuzzyMatches(item.product_name, allProducts);
                if (fuzzyMatches.length > 0) {
                    // Use AI to select the best match from top candidates
                    const topCandidates = fuzzyMatches.slice(0, 5);
                    const aiSelectedMatch = await selectBestMatchWithAI(item.product_name, topCandidates);
                    
                    if (aiSelectedMatch) {
                        bestMatch = aiSelectedMatch;
                        // Determine confidence based on similarity score
                        if (aiSelectedMatch.similarity > 0.7) {
                            matchConfidence = 'high';
                        } else if (aiSelectedMatch.similarity > 0.4) {
                            matchConfidence = 'medium';
                        } else {
                            matchConfidence = 'low';
                        }
                        suggestions = fuzzyMatches.slice(0, 4)
                            .filter(p => p.product_name !== aiSelectedMatch.product_name)
                            .map(p => p.product_name);
                    } else {
                        bestMatch = fuzzyMatches[0];
                        matchConfidence = 'low';
                        suggestions = fuzzyMatches.slice(1, 4).map(p => p.product_name);
                    }
                }
            }

            // Strategy 4: AI-powered semantic search (fallback)
            if (!bestMatch) {
                const semanticMatches = await findSemanticMatches(item.product_name, allProducts);
                if (semanticMatches.length > 0) {
                    bestMatch = semanticMatches[0];
                    matchConfidence = 'medium';
                    suggestions = semanticMatches.slice(1, 4).map(p => p.product_name);
                }
            }

            if (bestMatch) {
                matchedItems.push({
                    original_text: item.original_text || item.product_name,
                    matched_product: bestMatch,
                    product_id: bestMatch.id,
                    product_name: bestMatch.product_name,
                    sku: bestMatch.sku,
                    quantity: item.quantity,
                    unit: item.unit,
                    //we changed the use the bestMatch instead of item.price
                    unit_price: bestMatch.price || 0,
                    total_price: item.quantity * (bestMatch.price || 0),
                    confidence: matchConfidence,
                    in_stock: bestMatch.quantity >= item.quantity,
                    current_stock: bestMatch.quantity,
                    stock_status: bestMatch.quantity >= item.quantity ? 'in_stock' :
                        bestMatch.quantity > 0 ? 'low_stock' : 'out_of_stock',
                    ai_suggestions: suggestions.length > 0 ? suggestions : undefined,
                });
            } else {
                // No match found
                const fuzzyMatches = findFuzzyMatches(item.product_name, allProducts);
                matchedItems.push({
                    original_text: item.original_text || item.product_name,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit: item.unit,
                    unit_price: item.price || 0,
                    total_price: item.quantity * (item.price || 0),
                    confidence: 'no_match',
                    in_stock: false,
                    stock_status: 'not_found',
                    ai_suggestions: fuzzyMatches.slice(0, 5).map(p => p.product_name),
                });
            }
        } catch (error) {
            console.error('Error matching item:', error);
            matchedItems.push({
                original_text: item.original_text || item.product_name,
                product_name: item.product_name,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.price || 0,
                total_price: item.quantity * (item.price || 0),
                confidence: 'low',
                in_stock: false,
                stock_status: 'error',
            });
        }
    }

    return matchedItems;
}

/**
 * Calculate text similarity (improved from openai2.ts)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return totalWords > 0 ? commonWords.length / totalWords : 0;
}

/**
 * Find exact match in products (enhanced)
 */
function findExactMatch(productName: string, products: any[]): any {
    const normalizedName = productName.toLowerCase().trim();

    return products.find(p => {
        const pName = p.product_name.toLowerCase();
        const pSku = (p.sku || '').toLowerCase();
        const pBarcode = (p.barcode || '').toLowerCase();

        return pName === normalizedName ||
            pSku === normalizedName ||
            pBarcode === normalizedName ||
            pName.includes(normalizedName) ||
            normalizedName.includes(pName);
    });
}

/**
 * Find fuzzy matches using string similarity
 */
function findFuzzyMatches(productName: string, products: any[]): any[] {
    const normalizedName = productName.toLowerCase().trim();
    const words = normalizedName.split(' ');

    // Score each product using improved similarity calculation
    const scoredProducts = products.map(product => {
        const pName = product.product_name.toLowerCase();
        const pSku = (product.sku || '').toLowerCase();
        const pCategory = (product.category || '').toLowerCase();
        
        // Calculate similarity scores for different fields
        const nameSimilarity = calculateTextSimilarity(normalizedName, pName);
        const skuSimilarity = calculateTextSimilarity(normalizedName, pSku);
        const categorySimilarity = calculateTextSimilarity(normalizedName, pCategory);
        
        // Use the highest similarity score
        const maxSimilarity = Math.max(nameSimilarity, skuSimilarity, categorySimilarity);
        
        // Convert to scoring system (0-100)
        let score = maxSimilarity * 100;

        // Bonus for exact substring matches
        if (pName.includes(normalizedName) || normalizedName.includes(pName)) {
            score += 20;
        }

        // Bonus for matching key terms
        const keyTerms = ['fakher', 'adalya', 'starbuzz', 'coal', 'hose', 'bowl', 'tips'];
        keyTerms.forEach(term => {
            if (normalizedName.includes(term) && pName.includes(term)) {
                score += 15;
            }
        });

        return { 
            ...product, 
            matchScore: score,
            similarity: maxSimilarity
        };
    });

    // Sort by score and return top matches
    return scoredProducts
        .filter(p => p.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,    // deletion
                    dp[i][j - 1] + 1,    // insertion
                    dp[i - 1][j - 1] + 1 // substitution
                );
            }
        }
    }

    return dp[m][n];
}

/**
 * Use AI to select the best match from candidates (inspired by openai2.ts)
 */
async function selectBestMatchWithAI(productName: string, candidates: any[]): Promise<any> {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    try {
        const candidateList = candidates.slice(0, 5).map((item, index) =>
            `${index + 1}. ${item.sku || item.product_id}: ${item.product_name} (Category: ${item.category || 'N/A'}, Price: $${item.price || 'N/A'})`
        ).join('\n');

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an expert at matching product requests to inventory items. Respond with just the number of the best match, or '0' if none are good matches."
                },
                {
                    role: "user",
                    content: `Given the product request "${productName}" and the following inventory candidates:

${candidateList}

Which item is the best match? Respond with just the number (1-${Math.min(candidates.length, 5)}) of the best match, or "0" if none are good matches.

Consider:
- Product name similarity
- Category relevance  
- Common variations in naming (e.g., "fakher" vs "al fakher", "coals" vs "charcoal")
- Size/packaging similarities`
                }
            ],
            temperature: 0.1,
            max_tokens: 10
        });

        const response = completion.choices[0].message.content?.trim();
        const selectedIndex = parseInt(response || '0') - 1;
        
        if (selectedIndex >= 0 && selectedIndex < candidates.length) {
            return candidates[selectedIndex];
        }

        return null;
    } catch (error) {
        console.error('Error in AI selection:', error);
        // Fallback to highest similarity score
        return candidates[0];
    }
}

/**
 * Find semantic matches using OpenAI embeddings
 */
async function findSemanticMatches(productName: string, products: any[]): Promise<any[]> {
    try {
        // Get embedding for the search term
        const searchEmbedding = await getEmbedding(productName);

        // Calculate similarity scores for all products
        const scoredProducts = await Promise.all(
            products.map(async (product) => {
                try {
                    // In production, you'd cache these embeddings in your database
                    const productEmbedding = await getEmbedding(product.product_name);
                    const similarity = cosineSimilarity(searchEmbedding, productEmbedding);
                    return { ...product, similarity };
                } catch (error) {
                    return { ...product, similarity: 0 };
                }
            })
        );

        // Sort by similarity and return top matches
        return scoredProducts
            .filter(p => p.similarity > 0.7) // Threshold for semantic similarity
            .sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
        console.error('Error in semantic matching:', error);
        return [];
    }
}

/**
 * Get embedding for a text using OpenAI
 */
async function getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error('Error getting embedding:', error);
        return [];
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length || vec1.length === 0) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Batch process multiple orders
 */
export async function batchProcessOrders(orders: string[]): Promise<ParsedOrderItem[][]> {
    try {
        const systemPrompt = `You are an expert order processing assistant. Parse multiple orders at once.
    
    Return a JSON object with an "orders" array, where each order contains an "items" array.
    Follow the same structure as single order processing.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Parse these orders:\n${orders.map((o, i) => `Order ${i + 1}: "${o}"`).join('\n')}` }
            ],
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: "json_object" }
        });

        const response = completion.choices[0].message.content;
        if (!response) throw new Error('No response from AI');

        const parsed = JSON.parse(response);
        return parsed.orders || [];
    } catch (error) {
        console.error('Error batch processing with OpenAI:', error);
        // Fallback to processing individually
        return Promise.all(orders.map(order => processOrderWithAI(order)));
    }
}

/**
 * Get product recommendations based on order history
 */
export async function getProductRecommendations(
    customerId: string,
    currentItems: string[],
    supabaseClient: any = supabase
): Promise<any[]> {
    try {
        // Fetch customer's order history
        const { data: orderHistory } = await supabaseClient
            .from('order_items')
            .select('product_name, quantity')
            .eq('order.customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!orderHistory || orderHistory.length === 0) {
            return [];
        }

        // Use OpenAI to generate recommendations
        const prompt = `Based on the customer's order history and current order, suggest complementary products.
    
    Order History (most frequent items):
   
    
    Current Order:
    ${currentItems.join(', ')}
    
    Suggest 5 complementary products that the customer might need. Consider:
    1. Products often bought together
    2. Consumables that might need restocking
    3. Accessories for the ordered items
    4. Popular items in the same category
    
    Return as JSON: { "recommendations": ["product1", "product2", ...] }`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a wholesale product recommendation expert." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });

        const response = completion.choices[0].message.content;
        if (!response) return [];

        const parsed = JSON.parse(response);
        return parsed.recommendations || [];
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return [];
    }
}

/**
 * Validate and correct order items using AI
 */
export async function validateOrderItems(items: ParsedOrderItem[]): Promise<{
    valid: boolean;
    corrections: Array<{ item: string; issue: string; suggestion: string }>;
}> {
    try {
        const prompt = `Review these order items for potential issues:
    ${items.map(item => `- ${item.quantity} ${item.unit} of ${item.product_name}`).join('\n')}
    
    Check for:
    1. Unusual quantities (too high or too low)
    2. Mismatched units (e.g., "cases" for items usually sold as "pieces")
    3. Potential typos or unclear product names
    4. Missing important details (flavor, size, etc.)
    
    Return JSON: {
      "valid": boolean,
      "corrections": [
        {
          "item": "item description",
          "issue": "what's wrong",
          "suggestion": "how to fix it"
        }
      ]
    }`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an order validation expert." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: "json_object" }
        });

        const response = completion.choices[0].message.content;
        if (!response) return { valid: true, corrections: [] };

        return JSON.parse(response);
    } catch (error) {
        console.error('Error validating order:', error);
        return { valid: true, corrections: [] };
    }
}