import { supabase } from '../../core/config/supabaseClient';
import { GoogleGenerativeAI} from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

// ─── Config ──────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_KEY!);
const ai = new GoogleGenAI({apiKey: process.env.VITE_GOOGLE_AI_KEY!});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductAttribute {
  name: string;
  values: string[];
}

interface ProductForEmbedding {
  id: string;
  name: string;
  description: string;
  category: string;
  attributes?: ProductAttribute[];
}

interface EmbeddingRecord {
  warehouseId: string;
  productId: string;
  semanticText: string;
  embedding: number[];
}

// ─── Semantic Text Builder ───────────────────────────────────────────────────

function buildSemanticText(product: ProductForEmbedding): string {
  // Build attribute lines from product.attributes (e.g., Source, Roast, Grind, etc.)
  const attributeLines: string[] = [];
  
  if (product.attributes && product.attributes.length > 0) {
    for (const attr of product.attributes) {
      const values = attr.values.filter(v => v && v.trim()).join(', ');
      if (values) {
        attributeLines.push(`${attr.name}: ${values}.`);
      }
    }
  }

  const semanticString = [
    `Category: ${product.category || 'Unknown'}.`,
    `Product Name: ${product.name || 'Unnamed'}.`,
    `Description: ${product.description || 'No description'}.`,
    ...attributeLines,
  ]
    .filter(Boolean)
    .join('\n');

  return semanticString;
}

// ─── google Embedding ────────────────────────────────────────────────────────
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



// ─── Supabase Upsert ─────────────────────────────────────────────────────────

async function saveEmbedding(record: EmbeddingRecord): Promise<void> {
  const { error } = await supabase
    .from('product_embeddings')
    .upsert(
      {
        warehouse_id: record.warehouseId,
        product_id: record.productId,
        semantic_text: record.semanticText,
        embedding: record.embedding,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'warehouse_id,product_id',
      }
    );

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function syncProductEmbedding(
  warehouseId: string,
  product: ProductForEmbedding
): Promise<void> {
  try {
    const semanticText = buildSemanticText(product);
    console.log(`[Embedding] Semantic text for ${product.id}:\n${semanticText}`);

    const embedding = await generateEmbedding(semanticText);
    console.log(`[Embedding] Generated ${embedding.length}-dim embedding for ${product.id}`);

    await saveEmbedding({
      warehouseId,
      productId: product.id,
      semanticText,
      embedding,
    });

    console.log(`[Embedding] Saved embedding for product ${product.id}`);
  } catch (error) {
    console.error(`[Embedding] Failed for product ${product.id}:`, error);
  }
}

// ─── Delete Embedding ────────────────────────────────────────────────────────

export async function deleteProductEmbedding(
  warehouseId: string,
  productId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_embeddings')
    .delete()
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
}