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

export interface ProductFilters {
  search?: string;
  inStock?: string; // "true" or "false"
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const getProductsRepo = async (
  userId: string,
  page: number,
  limit: number,
  filters: ProductFilters = {}
): Promise<{ products: ProductWithVariants[]; total: number }> => {
  const { search, inStock, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

  let productsRef: FirebaseFirestore.Query = db
    .collection('users')
    .doc(userId)
    .collection('products');

  // Apply sorting
  const validSortFields = ['createdAt', 'updatedAt', 'name', 'basePrice'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  productsRef = productsRef.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

  // Fetch all product docs (Firestore limitation: can't filter by subcollection aggregates)
  const allDocsSnap = await productsRef.get();
  let allDocs = allDocsSnap.docs;

  // ── Search filter (client-side, on product fields only) ──
  if (search && search.trim()) {
    const searchLower = search.toLowerCase();
    allDocs = allDocs.filter(doc => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      const category = (data.category || '').toLowerCase();
      return name.includes(searchLower) ||
             description.includes(searchLower) ||
             category.includes(searchLower);
    });
  }

  // Resolve ALL remaining docs to ProductWithVariants so we can filter by computed inStock
  // PERFORMANCE NOTE: This fetches variants for all search-matched docs.
  // For large inventories, denormalize `inStock` and `totalQuantity` onto the product doc.
  const allProducts = await Promise.all(
    allDocs.map(async (productDoc) => {
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

      const totalQty = variants.reduce((acc, v) => acc + (v.quantity || 0), 0);
      const computedInStock = displayProductData.active !== false && totalQty > 0;

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
        _computedInStock: computedInStock, // internal, stripped before return
      };
    })
  );

  // ── Apply inStock filter (now that we have variant data) ──
  let filteredProducts = allProducts;
  if (inStock === 'true') {
    filteredProducts = allProducts.filter(p => p._computedInStock);
  } else if (inStock === 'false') {
    filteredProducts = allProducts.filter(p => !p._computedInStock);
  }

  // Strip internal field before returning
  const cleanProducts = filteredProducts.map(({ _computedInStock, ...rest }) => rest as ProductWithVariants);

  const total = cleanProducts.length;
  const offset = (page - 1) * limit;
  const paginatedProducts = cleanProducts.slice(offset, offset + limit);

  return { products: paginatedProducts, total };
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

export interface InventoryStats {
  totalProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  totalUnits: number;
  totalInventoryValue: number;
}

export const getInventoryStatsRepo = async (
  userId: string
): Promise<InventoryStats> => {
  const productsRef = db
    .collection('users')
    .doc(userId)
    .collection('products');

  const allDocsSnap = await productsRef.get();
  const allDocs = allDocsSnap.docs;

  let totalProducts = 0;
  let inStockProducts = 0;
  let outOfStockProducts = 0;
  let lowStockProducts = 0;
  let totalUnits = 0;
  let totalInventoryValue = 0;

  await Promise.all(
    allDocs.map(async (productDoc) => {
      totalProducts++;

      const cashierProductData = productDoc.data();
      const sourceOwnerId = cashierProductData.sourceOwnerId as string | undefined;
      const sourceProductId = cashierProductData.sourceProductId as string | undefined;

      let displayProductData = cashierProductData;
      let ownerVariantsById = new Map<string, FirebaseFirestore.DocumentData>();

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

        const quantity = Number(
          cashierVariantData.quantity ??
          ownerVariantData?.quantity ??
          0
        );
        const price =
          ownerVariantData?.price ??
          cashierVariantData.price ??
          displayProductData.basePrice ??
          0;

        return { quantity, price };
      });

      const totalQty = variants.reduce((acc, v) => acc + v.quantity, 0);
      const isActive = displayProductData.active !== false;
      const inStock = isActive && totalQty > 0;

      if (inStock) inStockProducts++;
      else outOfStockProducts++;

      // Low stock: in stock but quantity between 1-5
      if (inStock && totalQty >= 1 && totalQty <= 5) {
        lowStockProducts++;
      }

      totalUnits += totalQty;
      totalInventoryValue += variants.reduce(
        (acc, v) => acc + v.quantity * v.price,
        0
      );
    })
  );

  return {
    totalProducts,
    inStockProducts,
    outOfStockProducts,
    lowStockProducts,
    totalUnits,
    totalInventoryValue,
  };
};

// Add this interface if not already present
export interface WarehouseProduct {
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
  variants?: { id: string; price: number; quantity: number; [key: string]: any }[];
}

// Add this function to fetch ALL products from ALL warehouses
export const getAllWarehouseProductsRepo = async (): Promise<WarehouseProduct[]> => {
  // Query only warehouse users — Firestore index handles the filtering
  const warehousesSnap = await db
    .collection('users')
    .where('role', '==', 'warehouse')
    .get();

  const allProducts: WarehouseProduct[] = [];

  await Promise.all(
    warehousesSnap.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const warehouseName = userData.name || userDoc.id;
      const warehouseEmail = userData.email || userDoc.id;

      const productsRef = userDoc.ref.collection('products');
      const productsSnap = await productsRef.get();

      await Promise.all(
        productsSnap.docs.map(async (productDoc) => {
          const data = productDoc.data();

          // Get product-level attributes definition
          const productAttributes = Array.isArray(data.attributes)
            ? data.attributes
            : [];

          // Fetch variants subcollection
          const variantsSnap = await productDoc.ref.collection('variants').get();
          const variants = variantsSnap.docs.map((vDoc) => {
            const vData = vDoc.data();

            // Build attributes object from product attribute names + variant values
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
          });
        })
      );
    })
  );

  return allProducts;
};