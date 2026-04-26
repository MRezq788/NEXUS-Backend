import { Response } from "express";
import { AuthRequest } from "../../core/middleware/auth.middleware";
import { createProductService, getProductsService } from './product.service';
import { successResponse, errorResponse, paginatedResponse } from "../../core/utils/response";
import { getInventoryStatsService } from './product.service';
import { getRecommendationsService } from './product.service';


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
    console.log(productId);
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
    const products = await getRecommendationsService();
    return successResponse(res, products, "Recommendations fetched successfully");
  } catch (error: any) {
    console.error("Get Recommendations Error:", error);
    return errorResponse(res, error.message ?? "Failed to fetch recommendations", 500);
  }
};
