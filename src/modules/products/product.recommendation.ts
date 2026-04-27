import { admin } from '../../core/config/firebase';
import { supabase } from '../../core/config/supabaseClient';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_KEY!);
const ai = new GoogleGenAI({apiKey: process.env.VITE_GOOGLE_AI_KEY!});

// ─── Config ──────────────────────────────────────────────────────────────────

const RECOMMENDATION_TOP_K = 50; // Variable: change this anytime

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderProduct {
  productId: string;
  [key: string]: any;
}

interface WarehouseOrder {
  id: string;
  executorId: string;
  executorType: string;
  products: OrderProduct[];
  [key: string]: any;
}

export interface RecommendedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  basePrice?: number;
  quantity: number;
  unit: string;
  category: string;
  images: string[];
  warehouseEmail: string;
  warehouseName: string;
  variants?: { id: string; price: number; quantity: number; attributes?: Record<string, string>; [key: string]: any }[];
}

// ─── Helper: Fetch Product Details for Semantic Building ─────────────────────

async function getProductDetailsForSemantic(
  warehouseId: string,
  productId: string
): Promise<{ name: string; category: string; description: string; attributes?: any[] } | null> {
  try {
    const productDoc = await db
      .collection('users')
      .doc(warehouseId)
      .collection('products')
      .doc(productId)
      .get();

    if (!productDoc.exists) return null;

    const data = productDoc.data()!;
    return {
      name: data.name || '',
      category: data.category || '',
      description: data.description || '',
      attributes: data.attributes || [],
    };
  } catch {
    return null;
  }
}

// ─── Helper: Build User Semantic Text ────────────────────────────────────────

async function buildUserSemanticText(
  orders: WarehouseOrder[]
): Promise<string> {
  // Extract unique product IDs with their warehouse (executorId)
  const uniqueProducts = new Map<string, string>(); // productId -> warehouseId

  for (const order of orders) {
    for (const product of order.products) {
      if (!uniqueProducts.has(product.productId)) {
        uniqueProducts.set(product.productId, order.executorId);
      }
    }
  }

  // Fetch product details and build semantic parts
  const semanticParts: string[] = [];
  semanticParts.push("User purchase history:");

  for (const [productId, warehouseId] of uniqueProducts) {
    const details = await getProductDetailsForSemantic(warehouseId, productId);
    if (details) {
      const attrText = details.attributes
        ?.map((a: any) => `${a.name}: ${a.values?.join(', ')}`)
        .filter(Boolean)
        .join('. ') || '';
      
      semanticParts.push(
        `- ${details.name} (${details.category})${attrText ? `. ${attrText}` : ''}`
      );
    }
  }

  return semanticParts.join('\n');
}

// ─── Helper: Generate Embedding ──────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: { taskType: 'SEMANTIC_SIMILARITY', outputDimensionality: 768 },
    });
    if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
      throw new Error('Failed to generate embedding: response does not contain valid embeddings');
    }
    console.log(`[Embedding] Google GenAI response:`, response.embeddings[0].values.length, 'dimensions');
    return response.embeddings[0].values;
}

// ─── Helper: Query Supabase for Similar Products ─────────────────────────────

async function getSimilarProductsFromSupabase(
  embedding: number[],
  topK: number
): Promise<{ warehouse_id: string; product_id: string; similarity: number }[]> {
  // Use Supabase RPC for vector similarity search
  // You need to create this function in Supabase first (see below)
  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: embedding,
    match_threshold: 0.0, // Return all, we'll limit by topK
    match_count: topK,
  });

  if (error) {
    console.error('Supabase similarity search failed:', error);
    return [];
  }

  return data || [];
}

// ─── Helper: Cold Start — Get Recent Products ────────────────────────────────

async function getColdStartProducts(topK: number): Promise<RecommendedProduct[]> {
  // Query all warehouse users
  const warehousesSnap = await db
    .collection('users')
    .where('role', '==', 'warehouse')
    .get();

  let allProducts: (RecommendedProduct & { createdAt?: any })[] = [];

  await Promise.all(
    warehousesSnap.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const warehouseName = userData.name || userDoc.id;
      const warehouseEmail = userData.email || userDoc.id;

      // Get products ordered by createdAt desc
      const productsSnap = await db
        .collection('users')
        .doc(userDoc.id)
        .collection('products')
        .orderBy('createdAt', 'desc')
        .limit(topK)
        .get();

      for (const productDoc of productsSnap.docs) {
        const data = productDoc.data();

        // Get variants
        const variantsSnap = await productDoc.ref.collection('variants').get();
        const variants = variantsSnap.docs.map((vDoc) => {
          const vData = vDoc.data();
          const productAttributes = data.attributes || [];
          const attributes: Record<string, string> = {};
          
          for (const attrDef of productAttributes) {
            const attrName = attrDef.name;
            if (attrName && vData[attrName] !== undefined) {
              attributes[attrName] = String(vData[attrName]);
            }
          }

          return {
            id: vDoc.id,
            quantity: Number(vData.quantity || 0),
            price: Number(vData.price || 0),
            attributes,
            ...vData,
          };
        });

        allProducts.push({
          id: productDoc.id,
          name: data.name || '',
          description: data.description || '',
          price: Number(data.price || data.basePrice || 0),
          basePrice: Number(data.basePrice || 0),
          quantity: Number(data.quantity || 0),
          unit: data.unit || 'unit',
          category: data.category || '',
          images: Array.isArray(data.images) ? data.images : [],
          warehouseEmail,
          warehouseName,
          variants: variants.length > 0 ? variants : undefined,
          createdAt: data.createdAt,
        });
      }
    })
  );

  // Sort by createdAt desc and take topK
  allProducts.sort((a, b) => {
    const aTime = a.createdAt?._seconds || 0;
    const bTime = b.createdAt?._seconds || 0;
    return bTime - aTime;
  });

  return allProducts.slice(0, topK);
}

// ─── Helper: Fetch Full Product by ID ────────────────────────────────────────

async function fetchFullProduct(
  warehouseId: string,
  productId: string
): Promise<RecommendedProduct | null> {
  try {
    const productDoc = await db
      .collection('users')
      .doc(warehouseId)
      .collection('products')
      .doc(productId)
      .get();

    if (!productDoc.exists) return null;

    const data = productDoc.data()!;

    // Get warehouse info
    const warehouseDoc = await db.collection('users').doc(warehouseId).get();
    const warehouseData = warehouseDoc.data() || {};
    const warehouseName = warehouseData.name || warehouseId;
    const warehouseEmail = warehouseData.email || warehouseId;

    // Get variants
    const variantsSnap = await productDoc.ref.collection('variants').get();
    const variants = variantsSnap.docs.map((vDoc) => {
      const vData = vDoc.data();
      const productAttributes = data.attributes || [];
      const attributes: Record<string, string> = {};
      
      for (const attrDef of productAttributes) {
        const attrName = attrDef.name;
        if (attrName && vData[attrName] !== undefined) {
          attributes[attrName] = String(vData[attrName]);
        }
      }

      return {
        id: vDoc.id,
        quantity: Number(vData.quantity || 0),
        price: Number(vData.price || 0),
        attributes,
        ...vData,
      };
    });

    return {
      id: productDoc.id,
      name: data.name || '',
      description: data.description || '',
      price: Number(data.price || data.basePrice || 0),
      basePrice: Number(data.basePrice || 0),
      quantity: Number(data.quantity || 0),
      unit: data.unit || 'unit',
      category: data.category || '',
      images: Array.isArray(data.images) ? data.images : [],
      warehouseEmail,
      warehouseName,
      variants: variants.length > 0 ? variants : undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch product ${productId}:`, error);
    return null;
  }
}

// ─── MAIN: Get Recommendations ───────────────────────────────────────────────

export async function getRecommendationsRepo(
  userId: string,
  topK: number = RECOMMENDATION_TOP_K
): Promise<RecommendedProduct[]> {
  // 1. Fetch user's orders where executorType = 'warehouse'
  const ordersSnap = await db
    .collection('users')
    .doc(userId)
    .collection('orders')
    .where('executorType', '==', 'warehouse')
    .get();

  const orders: WarehouseOrder[] = ordersSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as WarehouseOrder[];

  // 2. Cold start: no warehouse orders
  if (orders.length === 0) {
    console.log(`[Recommendations] No warehouse orders for ${userId}, using cold start`);
    return getColdStartProducts(topK);
  }

  // 3. Build user semantic text from unique products
  const userSemanticText = await buildUserSemanticText(orders);
  console.log(`[Recommendations] User semantic:\n${userSemanticText}`);

  // 4. Generate embedding
  const userEmbedding = await generateEmbedding(userSemanticText);

  // 5. Query Supabase for similar products
  const similarProducts = await getSimilarProductsFromSupabase(userEmbedding, topK);

  if (similarProducts.length === 0) {
    console.log(`[Recommendations] No similar products found, falling back to cold start`);
    return getColdStartProducts(topK);
  }

  // 6. Fetch full product details from Firestore
  const recommendedProducts: RecommendedProduct[] = [];
  
  for (const match of similarProducts) {
    const product = await fetchFullProduct(match.warehouse_id, match.product_id);
    if (product) {
      recommendedProducts.push(product);
    }
  }

  // Handle case where fewer than topK products were found
  if (recommendedProducts.length < topK) {
    console.log(`[Recommendations] Found ${recommendedProducts.length}/${topK} products, not filling remainder`);
    // Optional: fill with cold start products if you want exactly topK
    // const coldStart = await getColdStartProducts(topK - recommendedProducts.length);
    // return [...recommendedProducts, ...coldStart];
  }

  return recommendedProducts;
}