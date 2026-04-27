import { admin } from '../../core/config/firebase';
import { Product, ProductVariant, ProductStatus, computeStatus, formatDate } from './warehouse.product.model';
import { propagateOwnerProductToAllocatedSites } from '../siteProductVectors/siteProductVectorSync';

const db = admin.firestore();

// Get user's products subcollection reference
function getUserProductsCollection(userEmail: string) {
  return db.collection('users').doc(userEmail).collection('products');
}

export class ProductRepository {
  // Verify user exists
  async verifyUser(userEmail: string): Promise<boolean> {
    const userDoc = db.collection('users').doc(userEmail);
    const snapshot = await userDoc.get();
    return snapshot.exists;
  }

  // Get paginated products with optional filtering
  async findAll(
    userEmail: string,
    page: number,
    itemsPerPage: number,
    search?: string,
    status?: ProductStatus | 'All'
  ): Promise<{ products: Product[]; total: number }> {
    // Verify user exists
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) {
      throw new Error('User not found');
    }

    const productsRef = getUserProductsCollection(userEmail);

    // Build base query
    let q: FirebaseFirestore.Query = productsRef.orderBy('createdAt', 'desc');

    // Add status filter if specified
    if (status && status !== 'All') {
      q = q.where('status', '==', status);
    }

    // Get total count
    const countSnapshot = await q.count().get();
    const total = countSnapshot.data().count;

    // Fetch all and apply search/pagination in memory
    const snapshot = await q.get();
    
    let products: Product[] = [];
    
    snapshot.forEach((doc) => {
      products.push(this.formatProduct(doc));
    });

    // Apply search filter in memory
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination in memory
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);

    return {
      products: paginatedProducts,
      total: search ? products.length : total,
    };
  }

  // Get single product by ID
  async findById(userEmail: string, id: string): Promise<Product | null> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const productDoc = getUserProductsCollection(userEmail).doc(id);
    const snapshot = await productDoc.get();

    if (!snapshot.exists) return null;

    const variantsRef = productDoc.collection('variants');
    const variantsSnap = await variantsRef.get();
    const variants: ProductVariant[] = variantsSnap.docs.map((vDoc) => {
      const vData = vDoc.data();
      if (vData.attributes) {
        const { attributes, ...rest } = vData;
        return { id: vDoc.id, ...attributes, ...rest };
      }
      return { id: vDoc.id, ...vData } as ProductVariant;
    });

    return this.formatProduct(snapshot, variants);
  }

  // Create new product
  async create(userEmail: string, productData: Partial<Product>): Promise<Product> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const now = new Date();
    const status = computeStatus(productData.quantity || 0);

    const data: Record<string, any> = {
      name: productData.name || '',
      quantity: productData.quantity || 0,
      unit: productData.unit || 'kg',
      price: productData.price || 0,
      description: productData.description || '',
      status: status,
      category: productData.category || 'Uncategorized',
      lastUpdated: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Include optional fields if provided
    if (productData.basePrice !== undefined) data.basePrice = productData.basePrice;
    if (productData.images !== undefined) data.images = productData.images;
    if (productData.attributes !== undefined) data.attributes = productData.attributes;
    if (productData.active !== undefined) data.active = productData.active;

    const productsRef = getUserProductsCollection(userEmail);
    const batch = db.batch();
    const productDocRef = productsRef.doc(); // auto-ID for the product
    batch.set(productDocRef, data);

    // Create variants subcollection if provided
    if (Array.isArray(productData.variants) && productData.variants.length > 0) {
      for (const variant of productData.variants) {
        const variantRef = productDocRef.collection('variants').doc(); // auto-ID
        const { price, quantity, attributes, ...rest } = variant;
        batch.set(variantRef, {
          ...(attributes || {}),
          ...rest,
          price: price || 0,
          quantity: quantity || 0,
        });
      }
    }

    await batch.commit();
    
    return {
      id: productDocRef.id,
      ...data,
      lastUpdated: formatDate(now),
      createdAt: formatDate(now),
      updatedAt: formatDate(now),
    } as Product;
  }

  // Update product
  async update(userEmail: string, id: string, productData: Partial<Product>): Promise<Product | null> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const productDoc = getUserProductsCollection(userEmail).doc(id);
    const existing = await productDoc.get();

    if (!existing.exists) return null;

    const now = new Date();
    const updates: any = {
      updatedAt: now.toISOString(),
      lastUpdated: now.toISOString(),
    };

    if (productData.name       !== undefined) updates.name        = productData.name;
    if (productData.description !== undefined) updates.description = productData.description;
    if (productData.category   !== undefined) updates.category    = productData.category;
    if (productData.unit       !== undefined) updates.unit        = productData.unit;
    if (productData.images     !== undefined) updates.images      = productData.images;
    if (productData.attributes !== undefined) updates.attributes  = productData.attributes;
    if (productData.active     !== undefined) updates.active      = productData.active;
    if (productData.basePrice  !== undefined) {
      updates.basePrice = productData.basePrice;
      updates.price     = productData.basePrice;
    }
    if (productData.price !== undefined && productData.basePrice === undefined) {
      updates.price = productData.price;
    }
    if (productData.quantity !== undefined) {
      updates.quantity = productData.quantity;
      updates.status   = computeStatus(productData.quantity);
    }

    const batch = db.batch();
    batch.update(productDoc, updates);

    // Update variants subcollection while preserving stable variant IDs
    if (Array.isArray(productData.variants)) {
      const variantsRef = productDoc.collection('variants');
      const existingVariants = await variantsRef.get();

      const incomingVariantIds = new Set<string>();

      for (const variant of productData.variants) {
        const { id: incomingId, price, quantity, attributes, ...rest } = variant as ProductVariant & { id?: string };
        const variantId =
          typeof incomingId === 'string' && incomingId.trim().length > 0
            ? incomingId
            : variantsRef.doc().id;
        incomingVariantIds.add(variantId);

        const variantRef = variantsRef.doc(variantId);
        batch.set(variantRef, {
          ...(attributes || {}),
          ...rest,
          price: price,
          quantity: quantity,
        });
      }

      // Remove variants that no longer exist in payload
      existingVariants.forEach((vDoc) => {
        if (!incomingVariantIds.has(vDoc.id)) {
          batch.delete(vDoc.ref);
        }
      });
    }

    await batch.commit();

    // Re-fetch with variants
    const updated = await productDoc.get();
    const variantsSnap = await productDoc.collection('variants').get();
    const variants: ProductVariant[] = variantsSnap.docs.map((vDoc) => {
      const vData = vDoc.data();
      if (vData.attributes) {
        const { attributes, ...rest } = vData;
        return { id: vDoc.id, ...attributes, ...rest };
      }
      return { id: vDoc.id, ...vData } as ProductVariant;
    });

    const formattedProduct = this.formatProduct(updated, variants);

    try {
      await propagateOwnerProductToAllocatedSites(userEmail, id);
    } catch (error) {
      console.error('Allocated site product sync failed:', error);
    }

    return formattedProduct;
  }

  // Delete single product
  async delete(userEmail: string, id: string): Promise<boolean> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    try {
      const productDoc = getUserProductsCollection(userEmail).doc(id);

      // Delete variants subcollection first
      const variantsRef = productDoc.collection('variants');
      const variantsSnap = await variantsRef.get();
      const batch = db.batch();
      variantsSnap.forEach((vDoc) => batch.delete(vDoc.ref));
      batch.delete(productDoc);
      await batch.commit();

      return true;
    } catch (error) {
      return false;
    }
  }

  // Delete multiple products using batch
  async deleteBatch(userEmail: string, ids: string[]): Promise<number> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const batch = db.batch();
    let count = 0;

    for (const id of ids) {
      const productDoc = getUserProductsCollection(userEmail).doc(id);

      // Delete variants subcollection docs
      const variantsRef = productDoc.collection('variants');
      const variantsSnap = await variantsRef.get();
      variantsSnap.forEach((vDoc) => batch.delete(vDoc.ref));

      batch.delete(productDoc);
      count++;
    }

    await batch.commit();
    return count;
  }

  // Get statistics
  async getStats(userEmail: string): Promise<{ total: number; inStock: number; outOfStock: number }> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const productsRef = getUserProductsCollection(userEmail);
    const snapshot = await productsRef.get();
    
    let total = 0;
    let inStock = 0;
    let outOfStock = 0;

    snapshot.forEach((doc) => {
      total++;
      const data = doc.data();
      if (data.status === 'In Stock') inStock++;
      else if (data.status === 'Out of Stock') outOfStock++;
    });

    return { total, inStock, outOfStock };
  }

  // Safely convert a Firestore Timestamp, Date, ISO string, or null to a Date
  private toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // Format Firestore document to Product
  private formatProduct(doc: FirebaseFirestore.DocumentSnapshot, variants?: ProductVariant[]): Product {
    const data = doc.data()!;
    const createdDate     = this.toDate(data.createdAt);
    const updatedDate     = this.toDate(data.updatedAt);
    const lastUpdatedDate = this.toDate(data.lastUpdated);
    return {
      id: doc.id,
      name: data.name,
      quantity: data.quantity ?? 0,
      unit: data.unit ?? '',
      price: data.price ?? data.basePrice ?? 0,
      basePrice: data.basePrice ?? data.price ?? 0,
      description: data.description ?? '',
      status: data.status ?? computeStatus(data.quantity ?? 0),
      category: data.category ?? '',
      images: data.images ?? [],
      attributes: data.attributes ?? [],
      active: data.active ?? true,
      variants: variants ?? [],
      lastUpdated: lastUpdatedDate ? formatDate(lastUpdatedDate) : '',
      createdAt:   createdDate     ? formatDate(createdDate)     : '',
      updatedAt:   updatedDate     ? formatDate(updatedDate)     : '',
    };
  }
}

export const productRepository = new ProductRepository();
