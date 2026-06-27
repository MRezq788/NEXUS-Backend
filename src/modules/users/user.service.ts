import { getProductDetails } from "../products/product.repository";
import {
  getUserSoldAmount,
  getUserBoughtAmount,
  getOwnerSites,
  userRole,
  getUserSoldTotalForSpecificDay,
  getMostSoldItems,
  getUserData,
  getTopCashiersSelling,
  getUserRevenue,
  getTotalOrders,
  getRecentOrders,
  getRevenueGrowth,
  getTotalOrdersForPeriod,
  getTotalRevenueForPeriod,
  createUserDocument,
  CreateUserData,
  getUserProfileByEmail,
  createCashierAccount,
  CreateCashierData,
  getCashiersByBusinessOwner,
  allocateInventoryToCashierRepo,
  AllocationInventoryInput,
  returnInventoryFromCashierRepo,
  ReturnInventoryInput,
  getAllocationHistoryByUser,
  createCashierPosSaleRepo,
  CashierPosSaleItemInput,
  CashierPosSaleOrderInput,
  createBusinessOwnerStoreRepo,
  getBusinessOwnerStoresRepo,
  updateStoreAiAssistantRepo,
  getOwnerProductsForStoreAllocationRepo,
  getStoreAllocatedProductsRepo,
  allocateProductToStoreRepo,
  StoreProductAllocationInput,
  StoreAiAssistantSettings,
} from "./user.repository";
import { syncAllocatedSiteProductVector } from "../siteProductVectors/siteProductVectorSync";

export async function getUserSoldTotal(userId: string) {
  return await getUserSoldAmount(userId);
}

export async function getUserBoughtTotal(userId: string) {
  return await getUserBoughtAmount(userId);
}

export async function getUserOwnedSites(userId: string) {
  return await getOwnerSites(userId);
}

export async function getUserRole(userId: string) {
  return await userRole(userId);
}

export async function getUserSoldTotalForSpecificDayService(
  userId: string,
  date: Date,
) {
  return await getUserSoldTotalForSpecificDay(userId, date);
}

export async function getMostSoldProduct(userId: string, range: number) {
  const mostSoldProductsId = await getMostSoldItems(userId, range);

  const mostSoldProducts = [];
  for (const productId of mostSoldProductsId) {
    const product = await getProductDetails(productId, userId);
    if (product) {
      mostSoldProducts.push(product);
    }
  }

  return mostSoldProducts;
}

export async function getMostSellingCashiers(userId: string, range: number) {
  const cashiersWithTotals = await getTopCashiersSelling(userId, range);

  const mostSellingCashiers = [];
  for (const { cashierId, totalSold } of cashiersWithTotals) {
    const cashier = await getUserData(cashierId);
    if (cashier) {
      mostSellingCashiers.push({
        ...cashier,
        totalSold,
      });
    }
  }
  return mostSellingCashiers;
}

export async function getUserRevenueData(userId: string, period: string) {
  return await getUserRevenue(userId, period);
}

export async function getTotalOrdersService(userId: string) {
  return await getTotalOrders(userId);
}

export async function getRecentOrdersService(userId: string, limit: number) {
  return await getRecentOrders(userId, limit);
}

export async function getRevenueGrowthService(userId: string, period: string) {
  return await getRevenueGrowth(userId, period);
}

export async function getTotalOrdersForPeriodService(
  userId: string,
  period: string,
) {
  return await getTotalOrdersForPeriod(userId, period);
}

export async function getTotalRevenueForPeriodService(
  userId: string,
  period: string,
) {
  return await getTotalRevenueForPeriod(userId, period);
}

export async function getCurrentUserProfileService(email: string) {
  return await getUserProfileByEmail(email);
}

export const syncNewUser = async (data: CreateUserData) => {
  // Business Logic: Ensure the role is one of the allowed types
  const validRoles = ["business_owner", "warehouse", "app_User"];

  if (!validRoles.includes(data.role)) {
    throw new Error(`Business Logic Error: Invalid role '${data.role}'.`);
  }

  // Delegate the actual database creation to the repository
  return createUserDocument(data);
};

export const createCashierService = async (data: CreateCashierData) => {
  // Business Logic: Validate input
  if (!data.name || !data.email || !data.password || !data.businessOwnerId) {
    throw new Error("Business Logic Error: Missing required fields.");
  }

  if (data.password.length < 6) {
    throw new Error(
      "Business Logic Error: Password must be at least 6 characters.",
    );
  }

  // Email validation
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error("Business Logic Error: Invalid email format.");
  }

  // Verify the businessOwnerId exists and is a business owner
  const businessOwner = await getUserData(data.businessOwnerId);
  if (!businessOwner || !businessOwner.email) {
    throw new Error("Business Logic Error: Invalid business owner ID.");
  }

  if (businessOwner.role !== "business_owner") {
    throw new Error(
      "Business Logic Error: Only business owners can create cashier accounts.",
    );
  }

  // Create the cashier account
  return createCashierAccount(data);
};

export const getCashiersService = async (businessOwnerId: string) => {
  // Verify the business owner exists
  const businessOwner = await getUserData(businessOwnerId);
  if (!businessOwner || !businessOwner.email) {
    throw new Error("Business Logic Error: Invalid business owner ID.");
  }

  if (businessOwner.role !== "business_owner") {
    throw new Error("Business Logic Error: User is not a business owner.");
  }

  // Get all cashiers for this business owner
  return getCashiersByBusinessOwner(businessOwnerId);
};

export const allocateInventoryToCashierService = async (
  ownerEmail: string,
  payload: AllocationInventoryInput,
) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated business owner.");
  }

  const { cashierId, productId, variantId, quantity } = payload;

  if (!cashierId || !productId || !variantId) {
    throw new Error("Business Logic Error: cashierId, productId, and variantId are required.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Business Logic Error: quantity must be a positive integer.");
  }

  const businessOwner = await getUserData(ownerEmail);
  if (!businessOwner || !businessOwner.email) {
    throw new Error("Business Logic Error: Invalid business owner ID.");
  }

  if (businessOwner.role !== "business_owner") {
    throw new Error("Business Logic Error: Only business owners can allocate inventory.");
  }

  return allocateInventoryToCashierRepo(ownerEmail, payload);
};

export const returnInventoryFromCashierService = async (
  ownerEmail: string,
  payload: ReturnInventoryInput,
) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated business owner.");
  }

  const { cashierId, productId, variantId, quantity } = payload;

  if (!cashierId || !productId || !variantId) {
    throw new Error("Business Logic Error: cashierId, productId, and variantId are required.");
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Business Logic Error: quantity must be a positive integer.");
  }

  const businessOwner = await getUserData(ownerEmail);
  if (!businessOwner || !businessOwner.email) {
    throw new Error("Business Logic Error: Invalid business owner ID.");
  }

  if (businessOwner.role !== "business_owner") {
    throw new Error("Business Logic Error: Only business owners can return inventory from cashier.");
  }

  return returnInventoryFromCashierRepo(ownerEmail, payload);
};

export const getAllocationHistoryService = async (
  userEmail: string,
  limit: number,
) => {
  if (!userEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Business Logic Error: limit must be a positive integer.");
  }

  return getAllocationHistoryByUser(userEmail, limit);
};

export const createCashierPosSaleService = async (
  cashierEmail: string,
  items: CashierPosSaleItemInput[],
  order: CashierPosSaleOrderInput,
) => {
  if (!cashierEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Business Logic Error: At least one sale item is required.");
  }

  for (const item of items) {
    if (!item.productId || !item.variantId) {
      throw new Error("Business Logic Error: productId and variantId are required for each item.");
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Business Logic Error: quantity must be a positive integer for each item.");
    }

    if (!Number.isFinite(item.price) || item.price < 0) {
      throw new Error("Business Logic Error: price must be a non-negative number for each item.");
    }
  }


  if (!Number.isFinite(order.total) || order.total < 0) {
    throw new Error("Business Logic Error: total must be a non-negative number.");
  }

  return createCashierPosSaleRepo(cashierEmail, items, order);
};

export const listBusinessOwnerStoresService = async (ownerEmail: string) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  const user = await getUserData(ownerEmail);
  if (!user || user.role !== "business_owner") {
    throw new Error("Business Logic Error: Only business owners can access stores.");
  }

  return getBusinessOwnerStoresRepo(ownerEmail);
};

export const createBusinessOwnerStoreService = async (
  ownerEmail: string,
  siteNameRaw: string,
  storeDisplayName?: string,
) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  const normalizedSiteName = siteNameRaw.trim().toLowerCase();
  const validPattern = /^[a-z0-9-]{3,32}$/;

  if (!validPattern.test(normalizedSiteName)) {
    throw new Error(
      "Business Logic Error: siteName must be 3-32 chars and use lowercase letters, numbers, or hyphens.",
    );
  }

  return createBusinessOwnerStoreRepo(ownerEmail, normalizedSiteName, storeDisplayName?.trim() || undefined);
};

export const updateStoreAiAssistantService = async (
  ownerEmail: string,
  siteNameRaw: string,
  settings: StoreAiAssistantSettings,
) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  const user = await getUserData(ownerEmail);
  if (!user || user.role !== "business_owner") {
    throw new Error("Business Logic Error: Only business owners can update store AI settings.");
  }

  const normalizedSiteName = siteNameRaw.trim().toLowerCase();
  if (!normalizedSiteName) {
    throw new Error("Business Logic Error: siteName is required.");
  }

  return updateStoreAiAssistantRepo(ownerEmail, normalizedSiteName, {
    enabled: Boolean(settings.enabled),
    systemPrompt: settings.systemPrompt || "",
  });
};

export const listOwnerProductsForStoreAllocationService = async (ownerEmail: string) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  const user = await getUserData(ownerEmail);
  if (!user || user.role !== "business_owner") {
    throw new Error("Business Logic Error: Only business owners can access products.");
  }

  return getOwnerProductsForStoreAllocationRepo(ownerEmail);
};

export const listStoreAllocatedProductsService = async (
  ownerEmail: string,
  siteNameRaw: string,
) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  const normalizedSiteName = siteNameRaw.trim().toLowerCase();
  if (!normalizedSiteName) {
    throw new Error("Business Logic Error: siteName is required.");
  }

  return getStoreAllocatedProductsRepo(ownerEmail, normalizedSiteName);
};

export const allocateProductToStoreService = async (
  ownerEmail: string,
  payload: StoreProductAllocationInput,
) => {
  if (!ownerEmail) {
    throw new Error("Business Logic Error: Missing authenticated user.");
  }

  const user = await getUserData(ownerEmail);
  if (!user || user.role !== "business_owner") {
    throw new Error("Business Logic Error: Only business owners can allocate products to stores.");
  }

  const normalizedSiteName = payload.siteName.trim().toLowerCase();
  if (!normalizedSiteName || !payload.productId || !payload.variantId) {
    throw new Error("Business Logic Error: siteName, productId, and variantId are required.");
  }

  if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
    throw new Error("Business Logic Error: quantity must be a positive integer.");
  }

  const result = await allocateProductToStoreRepo(ownerEmail, {
    siteName: normalizedSiteName,
    productId: payload.productId,
    variantId: payload.variantId,
    quantity: payload.quantity,
  });

  let supabaseSync:
    | { status: "synced" }
    | { status: "skipped"; reason: string }
    | { status: "failed"; error: string } = {
    status: "skipped",
    reason: "not-attempted",
  };

  try {
    const syncOutcome = await syncAllocatedSiteProductVector(
      ownerEmail,
      normalizedSiteName,
      payload.productId,
    );
    if (syncOutcome?.skipped) {
      supabaseSync = { status: "skipped", reason: syncOutcome.skipped };
    } else {
      supabaseSync = { status: "synced" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[supabase-sync] allocation succeeded but vector sync FAILED site=${normalizedSiteName} product=${payload.productId}:`,
      error,
    );
    supabaseSync = { status: "failed", error: message };
  }

  return { ...result, supabaseSync };
};
