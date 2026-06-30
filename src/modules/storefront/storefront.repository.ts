import { admin, auth, db } from "../../core/config/firebase";

const SITES_COLLECTION = "sites";
const SITE_USERS_COLLECTION = "siteUsers";

export interface ListProductsQuery {
  search?: string;
  category?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "name";
}

export interface SitePageRecord extends Record<string, unknown> {
  id: string;
  isHomepage?: boolean;
}

export interface ProductRecord extends Record<string, unknown> {
  id: string;
  name?: string;
  category?: string;
  price: number;
  createdAt?: FirebaseFirestore.Timestamp;
}

export interface StorefrontSiteSettings {
  siteName: string;
  store: Record<string, unknown>;
}

const now = () => admin.firestore.Timestamp.now();

const stripPasswordHash = (record: Record<string, unknown>) => {
  const { passwordHash, ...safeRecord } = record as Record<string, unknown>;
  return safeRecord;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizePageSlug = (pageSlug: string) =>
  pageSlug
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");

const toSiteUserId = (siteName: string, email: string) =>
  `${normalizeEmail(email)}_${siteName.trim().toLowerCase()}`;

const getFirebaseErrorCode = (error: unknown) => {
  const coded = error as { code?: string; errorInfo?: { code?: string } };
  return coded?.code || coded?.errorInfo?.code || "";
};

const verifySiteUserToken = async (idToken: string) => {
  const decoded = await auth.verifyIdToken(idToken);
  const email = decoded.email;

  if (!email) {
    throw new Error("Firebase account must have an email");
  }

  return {
    uid: decoded.uid,
    email: normalizeEmail(email),
    name: String(decoded.name || decoded.email || ""),
  };
};

const createFirebaseUser = async (email: string, password: string, name: string) => {
  const normalizedEmail = normalizeEmail(email);

  try {
    await auth.getUserByEmail(normalizedEmail);
    throw new Error("Firebase account already exists. Please login first.");
  } catch (error) {
    if (getFirebaseErrorCode(error) !== "auth/user-not-found") {
      throw error;
    }
  }

  return auth.createUser({
    email: normalizedEmail,
    password,
    displayName: name,
  });
};

const createSiteUserRecord = async (
  siteName: string,
  email: string,
  firebaseUid: string,
  name: string,
) => {
  const normalizedEmail = normalizeEmail(email);
  const id = toSiteUserId(siteName, normalizedEmail);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);

  await userRef.set({
    email: normalizedEmail,
    name: name || normalizedEmail,
    siteName,
    firebaseUid,
    cart: { items: [] },
    wishlist: [],
    savedAddresses: [],
    createdAt: now(),
    updatedAt: now(),
  });

  const createdSnap = await userRef.get();
  return { id, ...stripPasswordHash(createdSnap.data() as Record<string, unknown>) };
};

const getOrCreateSiteUserFromFirebase = async (
  siteName: string,
  firebaseUid: string,
  email: string,
  name?: string,
) => {
  const normalizedEmail = normalizeEmail(email);
  const id = toSiteUserId(siteName, normalizedEmail);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return createSiteUserRecord(siteName, normalizedEmail, firebaseUid, name || normalizedEmail);
  }

  const userData = userSnap.data() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (userData.firebaseUid !== firebaseUid) {
    updates.firebaseUid = firebaseUid;
  }

  if (!userData.name && name) {
    updates.name = name;
  }

  if (Object.keys(updates).length) {
    await userRef.update({
      ...updates,
      updatedAt: now(),
    });
  }

  const updatedSnap = await userRef.get();
  return { id, ...stripPasswordHash(updatedSnap.data() as Record<string, unknown>) };
};

const siteRef = (siteName: string) => db.collection(SITES_COLLECTION).doc(siteName);
const pagesRef = (siteName: string) => siteRef(siteName).collection("pages");
const productsRef = (siteName: string) => siteRef(siteName).collection("allocatedProducts");

export const getOrCreateSite = async (siteName: string) => {
  const ref = siteRef(siteName);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      owner: "",
      store: {
        siteName,
        currency: "EGP",
        shippingFee: 75,
      },
      createdAt: now(),
      updatedAt: now(),
    });
  }

  return ref;
};

export const getSiteSettings = async (siteName: string): Promise<StorefrontSiteSettings> => {
  const ref = await getOrCreateSite(siteName);
  const snap = await ref.get();
  const data = snap.data() || {};

  return {
    siteName,
    store: (data.store as Record<string, unknown>) || {},
  };
};

export const listPages = async (siteName: string): Promise<SitePageRecord[]> => {
  await getOrCreateSite(siteName);

  const pagesSnap = await pagesRef(siteName).orderBy("createdAt", "asc").get();

  if (!pagesSnap.empty) {
    return pagesSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Record<string, unknown>),
    })) as SitePageRecord[];
  }

  const defaultPage = pagesRef(siteName).doc();

  await defaultPage.set({
    id: defaultPage.id,
    siteName,
    pageName: "Home",
    pageSlug: "",
    isHomepage: true,
    puckData: {
      content: [
        {
          type: "Hero",
          props: {
            heading: "Welcome to your new store",
            subtext: "Build your pages with drag and drop",
            ctaText: "Shop now",
            ctaLink: "/products",
            bgColor: "#f4f0e8",
          },
        },
        {
          type: "ProductGrid",
          props: { category: "", columns: 3, showPrice: true, showCartButton: true, gap: 16 },
        },
      ],
      root: { props: {} },
    },
    createdAt: now(),
    updatedAt: now(),
  });

  const defaultPageSnap = await defaultPage.get();

  return [
    {
      id: defaultPage.id,
      ...(defaultPageSnap.data() as Record<string, unknown>),
    },
  ] as SitePageRecord[];
};

export const createPage = async (siteName: string, pageName: string, pageSlug: string) => {
  await getOrCreateSite(siteName);

  const normalizedSlug = normalizePageSlug(pageSlug);
  const isHomepage = normalizedSlug === "" || normalizedSlug === "home";

  const page = pagesRef(siteName).doc();

  await page.set({
    id: page.id,
    siteName,
    pageName,
    pageSlug: isHomepage ? "" : normalizedSlug,
    isHomepage,
    puckData: { content: [], root: { props: {} } },
    createdAt: now(),
    updatedAt: now(),
  });

  const snap = await page.get();

  return {
    id: page.id,
    ...(snap.data() as Record<string, unknown>),
  };
};

export const updatePage = async (
  siteName: string,
  pageId: string,
  payload: {
    pageName?: string;
    pageSlug?: string;
    isHomepage?: boolean;
    puckData?: Record<string, unknown>;
  },
) => {
  const page = pagesRef(siteName).doc(pageId);
  const pageSnap = await page.get();

  if (!pageSnap.exists) {
    throw new Error("Page not found");
  }

  const pageSlug = payload.pageSlug === undefined ? undefined : payload.pageSlug.trim().toLowerCase();
  const normalizedPageSlug = pageSlug === undefined ? undefined : normalizePageSlug(pageSlug);

  if (payload.isHomepage || normalizedPageSlug === "" || normalizedPageSlug === "home") {
    const allPages = await pagesRef(siteName).get();

    await Promise.all(
      allPages.docs
        .filter((docSnap) => docSnap.id !== pageId && Boolean(docSnap.data().isHomepage))
        .map((docSnap) =>
          docSnap.ref.update({
            isHomepage: false,
            pageSlug: "",
            updatedAt: now(),
          }),
        ),
    );
  }

  await page.update({
    ...(payload.pageName !== undefined ? { pageName: payload.pageName } : {}),
    ...(normalizedPageSlug !== undefined
      ? {
          pageSlug: normalizedPageSlug === "home" ? "" : normalizedPageSlug,
          isHomepage: normalizedPageSlug === "" || normalizedPageSlug === "home",
        }
      : {}),
    ...(payload.isHomepage !== undefined ? { isHomepage: payload.isHomepage } : {}),
    ...(payload.puckData !== undefined ? { puckData: payload.puckData } : {}),
    updatedAt: now(),
  });

  const updatedPageSnap = await page.get();

  return {
    id: pageId,
    ...(updatedPageSnap.data() as Record<string, unknown>),
  };
};

export const deletePage = async (siteName: string, pageId: string) => {
  const page = pagesRef(siteName).doc(pageId);
  const pageSnap = await page.get();

  if (!pageSnap.exists) {
    throw new Error("Page not found");
  }

  if (Boolean(pageSnap.data()?.isHomepage)) {
    throw new Error("Homepage cannot be deleted");
  }

  await page.delete();
  return true;
};

export const getHomepage = async (siteName: string) => {
  const pages = await listPages(siteName);
  return pages.find((page) => Boolean(page.isHomepage)) || pages[0] || null;
};

export const getPageBySlug = async (siteName: string, pageSlug: string) => {
  const normalized = normalizePageSlug(pageSlug);
  const snapshot = await pagesRef(siteName).where("pageSlug", "==", normalized).limit(1).get();

  if (!snapshot.empty) {
    const pageDoc = snapshot.docs[0];
    return {
      id: pageDoc.id,
      ...(pageDoc.data() as Record<string, unknown>),
    };
  }

  const legacySnapshot = await pagesRef(siteName).where("pageSlug", "==", `/${normalized}`).limit(1).get();

  if (legacySnapshot.empty) {
    return null;
  }

  const pageDoc = legacySnapshot.docs[0];
  return {
    id: pageDoc.id,
    ...(pageDoc.data() as Record<string, unknown>),
  };
};

export const listAllocatedProducts = async (siteName: string, queryInput: ListProductsQuery) => {
  const productsSnap = await productsRef(siteName).get();

  const products: ProductRecord[] = await Promise.all(
    productsSnap.docs.map(async (productDoc) => {
      const data = productDoc.data() as Record<string, unknown>;
      const variantsSnap = await productDoc.ref.collection("variants").get();
      const variants = variantsSnap.docs.map((variantDoc) => ({
        id: variantDoc.id,
        ...(variantDoc.data() as Record<string, unknown>),
      }));

      const minVariantPrice = variants.length
        ? Math.min(
            ...variants.map((variant) => Number((variant as { price?: number }).price ?? data.price ?? data.basePrice ?? 0)),
          )
        : Number(data.price ?? data.basePrice ?? 0);

      return {
        id: productDoc.id,
        ...data,
        variants,
        price: Number(data.price ?? minVariantPrice ?? 0),
      } as ProductRecord;
    }),
  );

  const filtered = products.filter((product) => {
    const searchTerm = queryInput.search?.trim().toLowerCase() || "";
    const categoryTerm = queryInput.category?.trim().toLowerCase() || "";

    if (searchTerm) {
      const name = String(product.name ?? "").toLowerCase();
      if (!name.includes(searchTerm)) {
        return false;
      }
    }

    if (categoryTerm) {
      const category = String(product.category ?? "").toLowerCase();
      if (category !== categoryTerm) {
        return false;
      }
    }

    return true;
  });

  const sorted = filtered.sort((a, b) => {
    if (queryInput.sort === "price_asc") return a.price - b.price;
    if (queryInput.sort === "price_desc") return b.price - a.price;
    if (queryInput.sort === "name") return String(a.name ?? "").localeCompare(String(b.name ?? ""));

    const aCreated = a.createdAt?.toMillis?.() || 0;
    const bCreated = b.createdAt?.toMillis?.() || 0;
    return bCreated - aCreated;
  });

  return sorted;
};

export const getAllocatedProductById = async (siteName: string, productId: string) => {
  const productRef = productsRef(siteName).doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    return null;
  }

  const variantsSnap = await productRef.collection("variants").get();
  const variants = variantsSnap.docs.map((variantDoc) => ({
    id: variantDoc.id,
    ...(variantDoc.data() as Record<string, unknown>),
  }));

  return {
    id: productSnap.id,
    ...(productSnap.data() as Record<string, unknown>),
    variants,
  };
};

export const signupSiteUser = async (
  siteName: string,
  input: { idToken?: string; email?: string; name: string; password?: string },
) => {
  let firebaseUser: { uid: string; email: string; name: string };

  if (input.idToken) {
    firebaseUser = await verifySiteUserToken(input.idToken);
  } else {
    if (!input.email || !input.password) {
      throw new Error("Firebase ID token or email and password are required");
    }

    const createdUser = await createFirebaseUser(input.email, input.password, input.name);
    firebaseUser = {
      uid: createdUser.uid,
      email: normalizeEmail(createdUser.email || input.email),
      name: createdUser.displayName || input.name,
    };
  }

  const id = toSiteUserId(siteName, firebaseUser.email);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    throw new Error("Account already exists for this store");
  }

  return createSiteUserRecord(siteName, firebaseUser.email, firebaseUser.uid, input.name || firebaseUser.name);
};

export const loginSiteUser = async (siteName: string, idToken: string) => {
  const firebaseUser = await verifySiteUserToken(idToken);
  return getOrCreateSiteUserFromFirebase(siteName, firebaseUser.uid, firebaseUser.email, firebaseUser.name);
};

export const getSiteUser = async (siteName: string, email: string) => {
  const id = toSiteUserId(siteName, email);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return null;
  }

  return { id, ...stripPasswordHash(userSnap.data() as Record<string, unknown>) };
};

export const updateCart = async (
  siteName: string,
  email: string,
  items: Array<Record<string, unknown>>,
) => {
  const id = toSiteUserId(siteName, email);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);

  await userRef.update({
    cart: { items },
    updatedAt: now(),
  });

  const updatedSnap = await userRef.get();
  return { id, ...stripPasswordHash(updatedSnap.data() as Record<string, unknown>) };
};

export const updateWishlist = async (siteName: string, email: string, wishlist: string[]) => {
  const id = toSiteUserId(siteName, email);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);

  await userRef.update({
    wishlist,
    updatedAt: now(),
  });

  const updatedSnap = await userRef.get();
  return { id, ...stripPasswordHash(updatedSnap.data() as Record<string, unknown>) };
};

export const updateAddresses = async (
  siteName: string,
  email: string,
  savedAddresses: Array<Record<string, unknown>>,
) => {
  const id = toSiteUserId(siteName, email);
  const userRef = db.collection(SITE_USERS_COLLECTION).doc(id);

  await userRef.update({
    savedAddresses,
    updatedAt: now(),
  });

  const updatedSnap = await userRef.get();
  return { id, ...stripPasswordHash(updatedSnap.data() as Record<string, unknown>) };
};

export const createSiteOrder = async (
  siteName: string,
  payload: {
    customerEmail: string;
    customerName: string;
    customerPhone: string;
    shippingAddress: Record<string, unknown>;
    items: Array<Record<string, unknown>>;
    subtotal: number;
    shippingFee: number;
    total: number;
    notes?: string;
  },
) => {
  const orderRef = siteRef(siteName).collection("orders").doc();

  await orderRef.set({
    orderId: orderRef.id,
    siteName,
    customerEmail: payload.customerEmail,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    shippingAddress: payload.shippingAddress,
    items: payload.items,
    subtotal: payload.subtotal,
    shippingFee: payload.shippingFee,
    total: payload.total,
    paymentMethod: "cod",
    status: "pending",
    notes: payload.notes || "",
    createdAt: now(),
    updatedAt: now(),
  });

  const createdSnap = await orderRef.get();

  return {
    id: orderRef.id,
    ...(createdSnap.data() as Record<string, unknown>),
  };
};

export const getSiteUserOrders = async (siteName: string, email: string) => {
  const ordersSnap = await siteRef(siteName)
    .collection("orders")
    .where("customerEmail", "==", email.trim().toLowerCase())
    .orderBy("createdAt", "desc")
    .get();

  return ordersSnap.docs.map((orderDoc) => ({
    id: orderDoc.id,
    ...(orderDoc.data() as Record<string, unknown>),
  }));
};
