import { admin } from "../../core/config/firebase";
import {
  createHuggingFaceEmbedding,
  vectorToSqlLiteral,
} from "../../core/utils/huggingFaceEmbedding";

const db = admin.firestore();
const usersCollection = db.collection("users");

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

function toPlainValue(value: unknown): unknown {
  if (!value) return value;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(toPlainValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        toPlainValue(val),
      ]),
    );
  }
  return value;
}

function variantAttributes(variant: Record<string, unknown>) {
  // Filter out internal keys and non-primitive values
  return Object.fromEntries(
    Object.entries(variant).filter(([key, value]) => {
      return (
        !INTERNAL_VARIANT_KEYS.has(key) &&
        ["string", "number", "boolean"].includes(typeof value)
      );
    }),
  );
}

function searchableText(
  product: Record<string, unknown>,
  variants: Array<Record<string, unknown>>,
) {
  const attributes = Array.isArray(product.attributes)
    ? product.attributes
        .map((attribute) => {
          if (!attribute || typeof attribute !== "object") return "";
          const data = attribute as { name?: unknown; values?: unknown };
          const values = Array.isArray(data.values)
            ? data.values.join(" ")
            : "";
          return `${data.name ?? ""} ${values}`;
        })
        .join(" ")
    : "";

  const variantText = variants
    .map((variant) => {
      const attrs = variantAttributes(variant);
      return Object.entries(attrs)
        .map(([key, value]) => `${key} ${value}`)
        .join(" ");
    })
    .join(" ");

  return [
    product.name,
    product.description,
    product.category,
    product.basePrice,
    product.price,
    attributes,
    variantText,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        String(value).trim().length > 0,
    )
    .join(" ");
}

async function upsertSupabaseVector(
  row: Record<string, unknown>,
  context: { siteName: string; productId: string },
) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[supabase-sync] SKIP: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in process.env.",
    );
    return;
  }

  if (serviceRoleKey === "replace-with-your-supabase-service-role-key") {
    console.warn(
      "[supabase-sync] SKIP: SUPABASE_SERVICE_ROLE_KEY is still the placeholder value.",
    );
    return;
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/site_product_vectors?on_conflict=site_name,product_id`;
  const keyPreview = `${serviceRoleKey.slice(0, 8)}…${serviceRoleKey.slice(-6)} (len=${serviceRoleKey.length})`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(row),
    });
  } catch (networkErr) {
    console.error(
      `[supabase-sync] network failure to ${endpoint} key=${keyPreview}:`,
      networkErr,
    );
    throw networkErr;
  }

  if (!response.ok) {
    const message = await response.text();
    console.error(
      `[supabase-sync] non-2xx response status=${response.status} body=${message}`,
    );
    throw new Error(
      `Supabase vector sync failed: ${response.status} ${message}`,
    );
  }
}

export async function syncAllocatedSiteProductVector(
  ownerEmail: string,
  siteName: string,
  productId: string,
): Promise<{ skipped?: string }> {
  const siteProductRef = db
    .collection("sites")
    .doc(siteName)
    .collection("allocatedProducts")
    .doc(productId);

  const [ownerSnap, siteSnap, productSnap, variantsSnap] = await Promise.all([
    usersCollection.doc(ownerEmail).get(),
    db.collection("sites").doc(siteName).get(),
    siteProductRef.get(),
    siteProductRef.collection("variants").get(),
  ]);

  if (!siteSnap.exists) {
    console.warn(`[supabase-sync] SKIP: site doc missing for site=${siteName}`);
    return { skipped: "site-missing" };
  }
  if (!productSnap.exists) {
    console.warn(
      `[supabase-sync] SKIP: allocated product doc missing for site=${siteName} product=${productId}`,
    );
    return { skipped: "product-missing" };
  }

  const owner = toPlainValue(ownerSnap.data() || {}) as Record<string, unknown>;
  const site = toPlainValue(siteSnap.data() || {}) as Record<string, unknown>;
  const product = toPlainValue(productSnap.data() || {}) as Record<
    string,
    unknown
  >;
  const variants: Array<Record<string, unknown>> = variantsSnap.docs.map(
    (doc) => ({
      id: doc.id,
      ...(toPlainValue(doc.data()) as Record<string, unknown>),
    }),
  );
  const totalQuantity = variants.reduce(
    (sum, variant) => sum + (Number(variant.quantity) || 0),
    0,
  );
  const text = searchableText(product, variants);
  const embeddingVector = await createHuggingFaceEmbedding(text);

  await upsertSupabaseVector(
    {
      site_name: siteName,
      owner_email: ownerEmail,
      product_id: productId,
      object: {
        id: productId,
        siteName,
        ownerEmail,
        ownerName: owner.name ?? ownerEmail,
        site: site.store ?? site,
        product,
        variants,
        totalQuantity,
      },
      searchable_text: text,
      embedding: vectorToSqlLiteral(embeddingVector),
      updated_at: new Date().toISOString(),
    },
    { siteName, productId },
  );

  return {};
}

export async function syncOwnerProductAllocations(
  ownerEmail: string,
  productId: string,
) {
  const ownerSnap = await usersCollection.doc(ownerEmail).get();
  const siteIds = ownerSnap.data()?.siteIds;
  if (!Array.isArray(siteIds) || siteIds.length === 0) return;

  await Promise.all(
    siteIds.map(async (siteNameRaw) => {
      const siteName = String(siteNameRaw);
      const siteProductRef = db
        .collection("sites")
        .doc(siteName)
        .collection("allocatedProducts")
        .doc(productId);
      const productSnap = await siteProductRef.get();
      if (!productSnap.exists) return;

      await syncAllocatedSiteProductVector(ownerEmail, siteName, productId);
    }),
  );
}

export async function propagateOwnerProductToAllocatedSites(
  ownerEmail: string,
  productId: string,
) {
  const ownerRef = usersCollection.doc(ownerEmail);
  const ownerSnap = await ownerRef.get();
  const siteIds = ownerSnap.data()?.siteIds;
  if (!Array.isArray(siteIds) || siteIds.length === 0) return;

  const ownerProductRef = ownerRef.collection("products").doc(productId);
  const [ownerProductSnap, ownerVariantsSnap] = await Promise.all([
    ownerProductRef.get(),
    ownerProductRef.collection("variants").get(),
  ]);

  if (!ownerProductSnap.exists) return;

  const productData = ownerProductSnap.data() || {};
  const ownerVariantsById = new Map(
    ownerVariantsSnap.docs.map((doc) => [doc.id, doc.data()]),
  );
  const now = admin.firestore.FieldValue.serverTimestamp();

  await Promise.all(
    siteIds.map(async (siteNameRaw) => {
      const siteName = String(siteNameRaw);
      const siteProductRef = db
        .collection("sites")
        .doc(siteName)
        .collection("allocatedProducts")
        .doc(productId);
      const siteProductSnap = await siteProductRef.get();
      if (!siteProductSnap.exists) return;

      const siteVariantsSnap = await siteProductRef
        .collection("variants")
        .get();
      const batch = db.batch();

      batch.set(
        siteProductRef,
        {
          ...productData,
          allocatedBy: ownerEmail,
          sourceOwnerId: ownerEmail,
          sourceProductId: productId,
          sourceProductRef: ownerProductRef.path,
          updatedAt: now,
        },
        { merge: true },
      );

      siteVariantsSnap.docs.forEach((siteVariantDoc) => {
        const ownerVariant = ownerVariantsById.get(siteVariantDoc.id);
        if (!ownerVariant) return;
        const currentSiteQuantity = Number(siteVariantDoc.data().quantity) || 0;
        batch.set(
          siteVariantDoc.ref,
          {
            ...ownerVariant,
            quantity: currentSiteQuantity,
            sourceOwnerId: ownerEmail,
            sourceProductId: productId,
            sourceVariantId: siteVariantDoc.id,
            sourceVariantRef: ownerProductRef
              .collection("variants")
              .doc(siteVariantDoc.id).path,
            updatedAt: now,
          },
          { merge: true },
        );
      });

      await batch.commit();
      await syncAllocatedSiteProductVector(ownerEmail, siteName, productId);
    }),
  );
}
