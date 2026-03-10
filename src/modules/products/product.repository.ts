import { admin } from '../../core/config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface ProductVariant {
  attributes: Record<string, string>;
  price: number;
  quantity: number;
}

export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface CreateProductInput {
  name: string;
  description: string;
  basePrice: number;
  category: string;
  images: string[];
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  active: boolean;
}

export interface ProductWithVariants {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: string;
  images: string[];
  attributes: ProductAttribute[];
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
  variants: (ProductVariant & { id: string })[];
}

export const getProductsRepo = async (
  userId: string,
  page: number,
  limit: number
): Promise<{ products: ProductWithVariants[]; total: number }> => {
  const productsRef = db
    .collection('users')
    .doc(userId)
    .collection('products')
    .orderBy('createdAt', 'desc');

  const countSnap = await productsRef.count().get();
  const total = countSnap.data().count;

  const offset = (page - 1) * limit;
  const productsSnap = await productsRef.offset(offset).limit(limit).get();

  const products = await Promise.all(
    productsSnap.docs.map(async (productDoc) => {
      const data = productDoc.data();

      const variantsSnap = await productDoc.ref.collection('variants').get();
      const variants = variantsSnap.docs.map((vDoc) => ({
        id: vDoc.id,
        ...(vDoc.data() as ProductVariant),
      }));

      return {
        id: productDoc.id,
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        category: data.category,
        images: data.images ?? [],
        attributes: data.attributes ?? [],
        active: data.active,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
        variants,
      } as ProductWithVariants;
    })
  );

  return { products, total };
};

export const getProductDetails = async (productId: string, userId: string) => {
  const productRef = db
    .collection('users')
    .doc(userId)
    .collection('products')
    .doc(productId);

  const snapshot = await productRef.get();
  return snapshot.data() || {};
};

export const createProductRepo = async (
  userId: string,
  input: CreateProductInput
): Promise<string> => {
  const productsRef = db.collection('users').doc(userId).collection('products');
  const productDocRef = productsRef.doc(); // auto-id
  const productId = productDocRef.id;

  const now = FieldValue.serverTimestamp();

  const batch = db.batch();

  batch.set(productDocRef, {
    name: input.name,
    description: input.description,
    basePrice: input.basePrice,
    category: input.category,
    images: input.images,
    attributes: input.attributes,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  });

  for (const variant of input.variants) {
    const rawId = Object.values(variant.attributes)
      .join('_')
      .toLowerCase()
      .replace(/\s+/g, '_');
    const variantId = rawId || 'default';

    const variantRef = productDocRef.collection('variants').doc(variantId);
    batch.set(variantRef, {
      attributes: variant.attributes,
      price: variant.price,
      quantity: variant.quantity,
    });
  }

  await batch.commit();

  return productId;
};