import { admin } from '../../core/config/firebase';
import { supabase } from '../../core/config/supabaseClient';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_KEY!);
const ai = new GoogleGenAI({apiKey: process.env.VITE_GOOGLE_AI_KEY!});

// ─── Config ──────────────────────────────────────────────────────────────────

const RECOMMENDATION_TOP_K = 8;
const MIN_RECOMMENDATION_SIMILARITY = 0.6;

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderProduct {
  productId: string;
  productName?: string;
  variantAttributes?: Record<string, string>;
  [key: string]: any;
}

interface WarehouseOrder {
  id: string;
  executorId: string;
  executorType: string;
  products: OrderProduct[];
  [key: string]: any;
}

interface UserSemanticContext {
  text: string;
  purchasedProductKeys: Set<string>;
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
): Promise<UserSemanticContext> {
  // Extract unique product IDs with their warehouse (executorId)
  const uniqueProducts = new Map<
    string,
    { warehouseId: string; productId: string; orderProduct: OrderProduct }
  >();

  for (const order of orders) {
    for (const product of order.products) {
      if (!order.executorId || !product.productId) continue;

      const key = `${order.executorId}::${product.productId}`;
      if (!uniqueProducts.has(key)) {
        uniqueProducts.set(key, {
          warehouseId: order.executorId,
          productId: product.productId,
          orderProduct: product,
        });
      }
    }
  }

  // Fetch product details and build semantic parts
  const semanticParts: string[] = [];
  semanticParts.push("User purchase history:");

  for (const { productId, warehouseId, orderProduct } of uniqueProducts.values()) {
    const details = await getProductDetailsForSemantic(warehouseId, productId);
    if (details) {
      const attrText = details.attributes
        ?.map((a: any) => `${a.name}: ${a.values?.join(', ')}`)
        .filter(Boolean)
        .join('. ') || '';
      
      semanticParts.push(
        [
          `- Product Name: ${details.name}`,
          `Category: ${details.category || 'Unknown'}`,
          details.description ? `Description: ${details.description}` : '',
          attrText,
        ].filter(Boolean).join('. ')
      );
      continue;
    }

    const fallbackParts = [
      orderProduct.productName ? `- Product Name: ${orderProduct.productName}` : '',
      orderProduct.variantAttributes
        ? `Variant: ${Object.entries(orderProduct.variantAttributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}`
        : '',
    ].filter(Boolean);

    if (fallbackParts.length > 0) {
      semanticParts.push(fallbackParts.join('. '));
    }
  }

  return {
    text: semanticParts.length > 1 ? semanticParts.join('\n') : '',
    purchasedProductKeys: new Set(uniqueProducts.keys()),
  };
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
    // console.log(`[Embedding] Google GenAI response:`, response.embeddings[0].values.length, 'dimensions');
    return response.embeddings[0].values;
}

// ─── Helper: Query Supabase for Similar Products ─────────────────────────────

async function getSimilarProductsFromSupabase(
  embedding: number[],
  topK: number,
  minSimilarity: number
): Promise<{ warehouse_id: string; product_id: string; similarity: number }[]> {
  // Use Supabase RPC for vector similarity search
  // You need to create this function in Supabase first (see below)
  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: embedding,
    match_threshold: minSimilarity,
    match_count: topK,
  });

  if (error) {
    console.error('Supabase similarity search failed:', error);
    return [];
  }

  return (data || [])
    .filter((match: { similarity?: number }) =>
      typeof match.similarity === 'number' && match.similarity >= minSimilarity
    )
    .sort(
      (
        a: { similarity: number },
        b: { similarity: number },
      ) => b.similarity - a.similarity,
    );
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

  const relevantOrders = orders.filter(
    (order) =>
      order.executorType === 'warehouse' &&
      order.type === 'bought' &&
      order.status !== 'cancelled' &&
      Array.isArray(order.products) &&
      order.products.length > 0,
  );

  // 2. Cold start: no warehouse orders
  if (relevantOrders.length === 0) {
    console.log(`[Recommendations] No warehouse orders for ${userId}, using cold start`);
    return getColdStartProducts(topK);
  }

  // 3. Build user semantic text from unique products
  const { text: userSemanticText, purchasedProductKeys } = await buildUserSemanticText(relevantOrders);
  console.log(`[Recommendations] User semantic:\n${userSemanticText}`);

  if (!userSemanticText) {
    console.log(`[Recommendations] Could not build user context from past orders for ${userId}`);
    return [];
  }

  // 4. Generate embedding
  const userEmbedding = await generateEmbedding(userSemanticText);

  // 5. Query Supabase for similar products
  const similarProducts = await getSimilarProductsFromSupabase(
    userEmbedding,
    topK * 3,
    MIN_RECOMMENDATION_SIMILARITY,
  );

  if (similarProducts.length === 0) {
    console.log(`[Recommendations] No similar products found for ${userId}`);
    return [];
  }

  // 6. Fetch full product details from Firestore
  const recommendedProducts: RecommendedProduct[] = [];
  
  for (const match of similarProducts) {
    const productKey = `${match.warehouse_id}::${match.product_id}`;
    if (purchasedProductKeys.has(productKey)) continue;

    const product = await fetchFullProduct(match.warehouse_id, match.product_id);
    if (product) {
      recommendedProducts.push(product);
    }

    if (recommendedProducts.length === topK) break;
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
