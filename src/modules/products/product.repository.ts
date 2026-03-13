import { admin } from '../../core/config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export interface ProductVariant {
  price: number;
  quantity: number;
  [key: string]: any;
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
      const variants = variantsSnap.docs.map((vDoc) => {
        const vData = vDoc.data();
        if (vData.attributes) {
            const { attributes, ...rest } = vData;
            return {
                id: vDoc.id,
                ...attributes,
                ...rest
            };
        }
        return {
          id: vDoc.id,
          ...vData,
        };
      });

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
    const variantRef = productDocRef.collection('variants').doc(); // auto-generated ID
    // Flatten attributes if they were sent within an attributes object, 
    // or just spread if already flattened from frontend
    const { price, quantity, attributes, ...rest } = variant;
    batch.set(variantRef, {
      ...(attributes || {}),
      ...rest,
      price,
      quantity,
    });
  }

  await batch.commit();

  return productId;
};