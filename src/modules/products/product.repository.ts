import { admin } from '../../core/config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { syncProductEmbedding } from './product.embedding';
import { propagateOwnerProductToAllocatedSites } from '../siteProductVectors/siteProductVectorSync';


const db = admin.firestore();

const INTERNAL_VARIANT_KEYS = new Set([
  "id",
  "price",
  "quantity",
  "basePrice",
  "active",
  "status",
  "sourceOwnerId",
  "sourceProductId",
  "sourceVariantId",
  "sourceProductRef",
  "sourceVariantRef",
  "createdAt",
  "updatedAt",
]);

// Client-side placeholders minted by AddProduct.tsx when (re)building the
// variants array from the attribute matrix. They must NEVER be persisted as
// Firestore doc IDs — that's what caused the "Variant not found in owner
// inventory" failure during allocation, because the allocation page would
// send the placeholder back and the subcollection lookup would miss.
const PLACEHOLDER_VARIANT_ID_PATTERNS = [
  /^default$/i,
  /^variant-\d+$/i,
  /^loaded-variant-\d+$/i,
];

function isPlaceholderVariantId(id: string): boolean {
  return PLACEHOLDER_VARIANT_ID_PATTERNS.some((pattern) => pattern.test(id));
}

export interface ProductVariant {
  id?: string;
  price: number;
  quantity: number;
  attributes?: Record<string, string | number | boolean>;
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

export type UpdateProductInput = CreateProductInput;

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

function expandVariantToNested(
  variantId: string,
  variantData: Record<string, unknown>,
  productAttributeNames: Set<string>,
) {
  const { price, quantity, attributes, ...rest } = variantData;
  const rawAttributes =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>)
      : rest;

  const normalizedAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawAttributes)) {
    if (INTERNAL_VARIANT_KEYS.has(key)) continue;
    if (productAttributeNames.size > 0 && !productAttributeNames.has(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      normalizedAttributes[key] = String(value);
    }
  }

  return {
    id: String(variantId),
    attributes: normalizedAttributes,
    price: Number(price ?? 0),
    quantity: Number(quantity ?? 0),
  };
}

export const getProductWithVariants = async (
  userId: string,
  productId: string,
) => {
  const productRef = db
    .collection("users")
    .doc(userId)
    .collection("products")
    .doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    return null;
  }

  const productData = productSnap.data() || {};
  const variantsSnap = await productRef.collection("variants").get();

  const productAttributes = Array.isArray(productData.attributes)
    ? (productData.attributes as ProductAttribute[])
    : [];
  const productAttributeNames = new Set(
    productAttributes.map((attribute) => String(attribute.name)),
  );

  const variants = variantsSnap.docs.map((variantDoc) =>
    expandVariantToNested(
      variantDoc.id,
      variantDoc.data() as Record<string, unknown>,
      productAttributeNames,
    ),
  );

  return {
    id: productId,
    name: productData.name ?? "",
    description: productData.description ?? "",
    basePrice: productData.basePrice ?? 0,
    category: productData.category ?? "",
    images: Array.isArray(productData.images) ? productData.images : [],
    attributes: productAttributes,
    active: productData.active ?? true,
    createdAt: productData.createdAt ?? null,
    updatedAt: productData.updatedAt ?? null,
    variants,
  };
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
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (userSnap.data()?.role === 'warehouse') {
    // Sync embedding to Supabase
    syncProductEmbedding(userId, {
      id: productId,
      name: input.name,
      description: input.description,
      category: input.category,
      attributes: input.attributes,
    }).catch((err) => {
      console.error('Embedding sync failed (non-blocking):', err);
    });
  }

  return productId;
};

export const updateProductRepo = async (
  userId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<{ variantIdMapping: Record<string, string> }> => {
  const productRef = db
    .collection("users")
    .doc(userId)
    .collection("products")
    .doc(productId);

  const productSnap = await productRef.get();
  if (!productSnap.exists) {
    throw new Error("Product not found");
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.update(productRef, {
    name: input.name,
    description: input.description,
    basePrice: input.basePrice,
    category: input.category,
    images: input.images,
    attributes: input.attributes,
    active: input.active,
    updatedAt: now,
  });

  // Snapshot existing variant doc ids BEFORE we delete them so we can
  // distinguish "real Firestore doc id from a previous save" from a
  // client-side placeholder like "variant-0" or "default".
  const existingVariantsSnap = await productRef.collection("variants").get();
  const existingVariantIds = new Set(
    existingVariantsSnap.docs.map((doc) => doc.id),
  );

  // Drop existing variants so removed attribute combinations disappear cleanly.
  existingVariantsSnap.docs.forEach((variantDoc) => {
    batch.delete(variantDoc.ref);
  });

  const variantIdMapping: Record<string, string> = {};

  for (const variant of input.variants) {
    const requestedId = typeof variant.id === "string" ? variant.id.trim() : "";

    // Only honor the requested id when it's a real existing Firestore doc id.
    // Anything else (placeholder, blank, or unknown id) gets a fresh auto-id
    // so the subcollection always ends up with real, stable Firestore ids
    // that the allocation page can resolve.
    const finalId =
      requestedId &&
      !isPlaceholderVariantId(requestedId) &&
      existingVariantIds.has(requestedId)
        ? requestedId
        : productRef.collection("variants").doc().id;

    if (requestedId && requestedId !== finalId) {
      variantIdMapping[requestedId] = finalId;
    }

    const variantRef = productRef.collection("variants").doc(finalId);

    const { id: _ignoredId, price, quantity, attributes, ...rest } = variant;
    batch.set(variantRef, {
      ...(attributes || {}),
      ...rest,
      price,
      quantity,
    });
  }

  await batch.commit();

  // Refresh every site copy and Supabase vector where this product is allocated
  // so the storefront and bot stay aligned with the latest owner data.
  try {
    await propagateOwnerProductToAllocatedSites(userId, productId);
  } catch (err) {
    console.error(
      `Propagate to allocated sites failed for product ${productId}:`,
      err,
    );
  }

  return { variantIdMapping };
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