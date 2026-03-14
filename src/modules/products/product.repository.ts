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
      const cashierProductData = productDoc.data();
      const sourceOwnerId = cashierProductData.sourceOwnerId as string | undefined;
      const sourceProductId = cashierProductData.sourceProductId as string | undefined;

      let displayProductData = cashierProductData;
      const ownerVariantsById = new Map<string, FirebaseFirestore.DocumentData>();

      if (sourceOwnerId && sourceProductId) {
        const ownerProductRef = db
          .collection('users')
          .doc(sourceOwnerId)
          .collection('products')
          .doc(sourceProductId);

        const [ownerProductSnap, ownerVariantsSnap] = await Promise.all([
          ownerProductRef.get(),
          ownerProductRef.collection('variants').get(),
        ]);

        if (ownerProductSnap.exists) {
          displayProductData = {
            ...ownerProductSnap.data(),
            ...cashierProductData,
          };
        }

        ownerVariantsSnap.docs.forEach((doc) => {
          ownerVariantsById.set(doc.id, doc.data());
        });
      }

      const variantsSnap = await productDoc.ref.collection('variants').get();
      const variants = variantsSnap.docs.map((vDoc) => {
        const cashierVariantData = vDoc.data();
        const sourceVariantId = (cashierVariantData.sourceVariantId as string) || vDoc.id;
        const ownerVariantData = ownerVariantsById.get(sourceVariantId);

        if (ownerVariantData?.attributes) {
          const { attributes, ...rest } = ownerVariantData;
          return {
            id: vDoc.id,
            ...attributes,
            ...rest,
            quantity: Number(cashierVariantData.quantity ?? ownerVariantData.quantity ?? 0),
            price: ownerVariantData.price ?? rest.price ?? 0,
          };
        }

        if (cashierVariantData.attributes) {
          const { attributes, ...rest } = cashierVariantData;
          return {
            id: vDoc.id,
            ...attributes,
            ...rest,
            quantity: Number(cashierVariantData.quantity ?? 0),
          };
        }

        return {
          id: vDoc.id,
          ...(ownerVariantData ?? {}),
          ...cashierVariantData,
          quantity: Number(cashierVariantData.quantity ?? ownerVariantData?.quantity ?? 0),
          price:
            ownerVariantData?.price ??
            cashierVariantData.price ??
            displayProductData.basePrice ??
            0,
        };
      });

      return {
        id: productDoc.id,
        name: displayProductData.name ?? '',
        description: displayProductData.description ?? '',
        basePrice: displayProductData.basePrice ?? 0,
        category: displayProductData.category ?? '',
        images: displayProductData.images ?? [],
        attributes: displayProductData.attributes ?? [],
        active: displayProductData.active ?? true,
        createdAt: cashierProductData.createdAt ?? null,
        updatedAt: cashierProductData.updatedAt ?? null,
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