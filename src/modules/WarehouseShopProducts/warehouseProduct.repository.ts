import { adminDb } from "../../core/config/adminFirebase";

const COLLECTION_NAME = "users";
const SUBCOLLECTION_NAME = "products";

interface RepoParams {
  email: string;
  limit: number;
  offset?: number;
  startAfter?: string;
  search?: string;
}

export interface ProductResult {
  id: string;
  [key: string]: any;
}

export const getProduct = async ({
  email,
  limit,
  offset,
  startAfter,
  search,
}: RepoParams) => {
  try {
    const productsRef = adminDb
      .collection(COLLECTION_NAME)
      .doc(email)
      .collection(SUBCOLLECTION_NAME);

    // 1. Start the query using the Admin SDK syntax
    let q: FirebaseFirestore.Query = productsRef;

    // 2. Apply search and sorting
    if (search) {
      const end = search + "\uf8ff";
      q = q.where("name", ">=", search).where("name", "<=", end);
      
      // CRITICAL: When using >= or <= on 'name', your first orderBy MUST be 'name'
      q = q.orderBy("name");
      q = q.orderBy("createdAt", "desc");
    } else {
      q = q.orderBy("createdAt", "desc");
    }

    if (startAfter) {
      const cursorDoc = await productsRef.doc(startAfter).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    } else if (offset && offset > 0) {
      q = q.offset(offset);
    }

    q = q.limit(limit);

    // 3. Execute the query using .get() instead of getDocs()
    const snapshot = await q.get();

    const results = await Promise.all(
      snapshot.docs.map(async (productDoc) => {
        const data = productDoc.data();
        
        // 4. Fetch variants using the Admin SDK
        const variantsRef = adminDb
          .collection(COLLECTION_NAME)
          .doc(email)
          .collection(SUBCOLLECTION_NAME)
          .doc(productDoc.id)
          .collection("variants");
          
        const variantsSnap = await variantsRef.get();
        const variants = variantsSnap.docs.map((variantDoc) => ({
          id: variantDoc.id,
          ...(variantDoc.data() as Record<string, unknown>),
        }));

        const variantsQuantity = variants.reduce((acc, variant) => {
          const quantity = Number(
            (variant as { quantity?: number }).quantity ?? 0,
          );
          return acc + (Number.isFinite(quantity) ? quantity : 0);
        }, 0);

        const hasVariants = variants.length > 0;
        const quantity = hasVariants
          ? variantsQuantity
          : Number(data.quantity ?? 0);

        const inStock = quantity > 0;
        const isActive = data.active !== false;

        if (!isActive || !inStock) {
          return null;
        }

        const minVariantPrice = hasVariants
          ? Math.min(
              ...variants.map((variant) =>
                Number(
                  (variant as { price?: number }).price ??
                    Number(data.basePrice ?? data.price ?? 0),
                ),
              ),
            )
          : Number(data.price ?? data.basePrice ?? 0);

        return {
          id: productDoc.id,
          ...data,
          variants,
          quantity,
          price: Number(data.price ?? minVariantPrice ?? 0),
          basePrice: Number(
            data.basePrice ?? data.price ?? minVariantPrice ?? 0,
          ),
          status: inStock ? "In Stock" : "Out of Stock",
        };
      }),
    );

    return results.filter(Boolean) as ProductResult[];
  } catch (err) {
    console.error("Firestore Admin SDK query failed:", err);
    throw new Error("Failed to query Firestore");
  }
};
