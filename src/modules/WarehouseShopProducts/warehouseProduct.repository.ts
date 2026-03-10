import {
  collection,
  query,
  where,
  orderBy,
  limit as limitFn,
  startAfter as startAfterFn,
  getDocs,
  QueryConstraint,
} from "firebase/firestore";

import { db } from "../../core/config/clientFirebase";

const COLLECTION_NAME = "users";
const SUBCOLLECTION_NAME = "products";

interface RepoParams {
  email: string;
  limit: number;
  startAfter?: string;
  search?: string;
}

export const getProduct = async ({
  email,
  limit,
  startAfter,
  search,
}: RepoParams) => {
  try {
    const constraints: QueryConstraint[] = [];

    if (search) {
      const end = search + "\uf8ff";
      constraints.push(where("name", ">=", search));
      constraints.push(where("name", "<=", end));
    }

    constraints.push(orderBy("createdAt", "desc"));

    if (startAfter) {
      constraints.push(startAfterFn(startAfter));
    }

    constraints.push(limitFn(limit));

    const q = query(
      collection(db, COLLECTION_NAME, email, SUBCOLLECTION_NAME),
      ...constraints,
    );

    const snapshot = await getDocs(q);

    const results = await Promise.all(
      snapshot.docs.map(async (productDoc) => {
        const data = productDoc.data();
        const variantsRef = collection(
          db,
          COLLECTION_NAME,
          email,
          SUBCOLLECTION_NAME,
          productDoc.id,
          "variants",
        );
        const variantsSnap = await getDocs(variantsRef);
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

    return results.filter(Boolean) as any[];
  } catch (err) {
    console.error("Firestore query failed:", err);
    throw new Error("Failed to query Firestore");
  }
};
