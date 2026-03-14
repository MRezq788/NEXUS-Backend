const INTERNAL_VARIANT_ATTRIBUTE_KEYS = new Set([
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

export const formatVariantAttributesSummary = (
  variantData: Record<string, unknown> = {},
): string => {
  const nestedAttributes = variantData.attributes;
  const source =
    nestedAttributes && typeof nestedAttributes === "object"
      ? (nestedAttributes as Record<string, unknown>)
      : variantData;

  return Object.entries(source)
    .filter(([key, value]) => {
      if (INTERNAL_VARIANT_ATTRIBUTE_KEYS.has(key)) return false;
      return typeof value === "string" && value.trim().length > 0;
    })
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
};