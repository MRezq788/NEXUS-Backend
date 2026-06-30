import { Response } from "express";
import { AuthRequest } from "../../core/middleware/auth.middleware";
import {
  createProductService,
  getProductsService,
  getProductService,
  updateProductService,
} from './product.service';
import { successResponse, errorResponse, paginatedResponse } from "../../core/utils/response";
import { getInventoryStatsService } from './product.service';
import { getRecommendationsService } from './product.service';

const asParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";


export const createProductController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = (req.headers["x-user-email"] as string) || req.user?.uid;

    if (!userId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const {
      name,
      description,
      basePrice,
      category,
      images,
      attributes,
      variants,
      active,
    } = req.body;

    const productId = await createProductService(userId, {
      name,
      description: description ?? "",
      basePrice,
      category: category ?? "",
      images: images ?? [],
      attributes: attributes ?? [],
      variants: variants ?? [],
      active: active ?? true,
    });
    return successResponse(
      res,
      { id: productId },
      "Product created successfully",
      201,
    );
  } catch (error: any) {
    console.error("Create Product Error:", error);
    return errorResponse(res, error.message ?? "Failed to create product", 500);
  }
};

export const getSingleProductController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = (req.headers["x-user-email"] as string) || req.user?.uid;
    if (!userId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const productId = asParam(req.params.id);
    if (!productId) {
      return errorResponse(res, "Product id is required", 400);
    }

    const product = await getProductService(userId, productId);
    if (!product) {
      return errorResponse(res, "Product not found", 404);
    }

    return successResponse(res, product, "Product fetched successfully");
  } catch (error: any) {
    console.error("Get Single Product Error:", error);
    return errorResponse(res, error.message ?? "Failed to fetch product", 500);
  }
};

export const updateProductController = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = (req.headers["x-user-email"] as string) || req.user?.uid;
    if (!userId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const productId = asParam(req.params.id);
    if (!productId) {
      return errorResponse(res, "Product id is required", 400);
    }

    const {
      name,
      description,
      basePrice,
      category,
      images,
      attributes,
      variants,
      active,
    } = req.body;

    const result = await updateProductService(userId, productId, {
      name,
      description: description ?? "",
      basePrice,
      category: category ?? "",
      images: images ?? [],
      attributes: attributes ?? [],
      variants: variants ?? [],
      active: active ?? true,
    });

    return successResponse(
      res,
      { id: productId, variantIdMapping: result.variantIdMapping },
      "Product updated successfully",
    );
  } catch (error: any) {
    console.error("Update Product Error:", error);
    if (error.message === "Product not found") {
      return errorResponse(res, error.message, 404);
    }
    return errorResponse(res, error.message ?? "Failed to update product", 500);
  }
};

export const getProductsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId =
      (req.headers["x-user-email"] as string) || req.user?.uid;

    if (!userId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const result = await getProductsService(userId, req.query);

    return paginatedResponse(res, result, "Products fetched successfully");
  } catch (error: any) {
    console.error("Get Products Error:", error);
    return errorResponse(res, error.message ?? "Failed to fetch products", 500);
  }
};

export const getInventoryStatsController = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId =
      (req.headers["x-user-email"] as string) || req.user?.uid;

    if (!userId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const stats = await getInventoryStatsService(userId);

    return successResponse(res, stats, "Inventory stats fetched successfully");
  } catch (error: any) {
    console.error("Get Inventory Stats Error:", error);
    return errorResponse(res, error.message ?? "Failed to fetch inventory stats", 500);
  }
};

export const getRecommendationsController = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.headers["x-user-email"] as string) || req.user?.uid;
    if (!userId) {
      return errorResponse(res, "Unauthorized", 401);
    }

    const products = await getRecommendationsService(userId);
    return successResponse(res, products, "Recommendations fetched successfully");
  } catch (error: any) {
    console.error("Get Recommendations Error:", error);
    return errorResponse(res, error.message ?? "Failed to fetch recommendations", 500);
  }
};
