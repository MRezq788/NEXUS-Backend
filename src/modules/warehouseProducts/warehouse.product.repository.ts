import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  getCountFromServer,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../core/config/clientFirebase';
import { Product, ProductVariant, ProductStatus, computeStatus, formatDate } from './warehouse.product.model';

// Get user's products subcollection reference
function getUserProductsCollection(userEmail: string) {
  const userDoc = doc(db, 'users', userEmail);
  return collection(userDoc, 'products');
}

export class ProductRepository {
  // Verify user exists
  async verifyUser(userEmail: string): Promise<boolean> {
    const userDoc = doc(db, 'users', userEmail);
    const snapshot = await getDoc(userDoc);
    return snapshot.exists();
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
    let constraints: any[] = [orderBy('createdAt', 'desc')];
    
    // Add status filter if specified
    if (status && status !== 'All') {
      constraints.push(where('status', '==', status));
    }

    // Get total count
    const countQuery = query(productsRef, ...constraints);
    const countSnapshot = await getCountFromServer(countQuery);
    const total = countSnapshot.data().count;

    // Fetch all and apply search/pagination in memory
    const q = query(productsRef, ...constraints);
    const snapshot = await getDocs(q);
    
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

    const productDoc = doc(getUserProductsCollection(userEmail), id);
    const snapshot = await getDoc(productDoc);

    if (!snapshot.exists()) return null;

    const variantsRef = collection(productDoc, 'variants');
    const variantsSnap = await getDocs(variantsRef);
    const variants: ProductVariant[] = variantsSnap.docs.map((vDoc) => ({
      id: vDoc.id,
      ...(vDoc.data() as Omit<ProductVariant, 'id'>),
    }));

    return this.formatProduct(snapshot, variants);
  }

  // Create new product
  async create(userEmail: string, productData: Partial<Product>): Promise<Product> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    const now = new Date();
    const status = computeStatus(productData.quantity || 0);

    const data = {
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

    const productsRef = getUserProductsCollection(userEmail);
    const docRef = await addDoc(productsRef, data);
    
    return {
      id: docRef.id,
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

    const productDoc = doc(getUserProductsCollection(userEmail), id);
    const existing = await getDoc(productDoc);

    if (!existing.exists()) return null;

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

    const batch = writeBatch(db);
    batch.update(productDoc, updates);

    // Replace variants subcollection if provided
    if (Array.isArray(productData.variants)) {
      // Delete existing variants first
      const variantsRef = collection(productDoc, 'variants');
      const existingVariants = await getDocs(variantsRef);
      existingVariants.forEach((vDoc) => batch.delete(vDoc.ref));

      // Write new variants
      for (const variant of productData.variants) {
        const rawId = Object.values(variant.attributes)
          .join('_')
          .toLowerCase()
          .replace(/\s+/g, '_');
        const variantId = rawId || 'default';
        const variantRef = doc(variantsRef, variantId);
        batch.set(variantRef, {
          attributes: variant.attributes,
          price:      variant.price,
          quantity:   variant.quantity,
        });
      }
    }

    await batch.commit();

    // Re-fetch with variants
    const updated = await getDoc(productDoc);
    const variantsSnap = await getDocs(collection(productDoc, 'variants'));
    const variants: ProductVariant[] = variantsSnap.docs.map((vDoc) => ({
      id: vDoc.id,
      ...(vDoc.data() as Omit<ProductVariant, 'id'>),
    }));

    return this.formatProduct(updated, variants);
  }

  // Delete single product
  async delete(userEmail: string, id: string): Promise<boolean> {
    const userExists = await this.verifyUser(userEmail);
    if (!userExists) throw new Error('User not found');

    try {
      const productDoc = doc(getUserProductsCollection(userEmail), id);

      // Delete variants subcollection first
      const variantsRef = collection(productDoc, 'variants');
      const variantsSnap = await getDocs(variantsRef);
      const batch = writeBatch(db);
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

    const batch = writeBatch(db);
    let count = 0;

    for (const id of ids) {
      const productDoc = doc(getUserProductsCollection(userEmail), id);

      // Delete variants subcollection docs
      const variantsRef = collection(productDoc, 'variants');
      const variantsSnap = await getDocs(variantsRef);
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
    const snapshot = await getDocs(productsRef);
    
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
  private formatProduct(doc: DocumentSnapshot<DocumentData>, variants?: ProductVariant[]): Product {
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