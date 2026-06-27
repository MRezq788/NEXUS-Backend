import { Request, Response } from "express";
import { storefrontService } from "./storefront.service";
import { runAiBuilder } from "./aiBuilder.service";

const asParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

const handleError = (res: Response, error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return res.status(400).json({ success: false, message });
};

export const aiBuilderController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const { prompt, currentPages, activePageId } = req.body as {
      prompt?: string;
      currentPages?: any[];
      activePageId?: string;
    };

    if (!prompt) {
      return res.status(400).json({ success: false, message: "prompt is required" });
    }

    const pages = await runAiBuilder(prompt, currentPages || [], activePageId, siteName);
    return res.json({ success: true, data: pages });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getSiteSettingsController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const settings = await storefrontService.getSiteSettings(siteName);
    return res.json({ success: true, data: settings });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listPagesController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const pages = await storefrontService.listPages(siteName);
    return res.json({ success: true, data: pages });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createPageController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const { pageName, pageSlug } = req.body as { pageName?: string; pageSlug?: string };

    if (!pageName) {
      return res.status(400).json({ success: false, message: "pageName is required" });
    }

    const page = await storefrontService.createPage(siteName, pageName, pageSlug || "");
    return res.status(201).json({ success: true, data: page });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updatePageController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const pageId = asParam(req.params.pageId);
    const page = await storefrontService.updatePage(siteName, pageId, req.body);
    return res.json({ success: true, data: page });
  } catch (error) {
    return handleError(res, error);
  }
};

export const deletePageController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const pageId = asParam(req.params.pageId);
    await storefrontService.deletePage(siteName, pageId);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getHomepageController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const page = await storefrontService.getHomepage(siteName);
    return res.json({ success: true, data: page });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getPageBySlugController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const pageSlug = asParam(req.params.pageSlug);
    const page = await storefrontService.getPageBySlug(siteName, pageSlug);

    if (!page) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }

    return res.json({ success: true, data: page });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listProductsController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const { search, category, sort } = req.query;

    const products = await storefrontService.listAllocatedProducts(siteName, {
      search: typeof search === "string" ? search : undefined,
      category: typeof category === "string" ? category : undefined,
      sort: typeof sort === "string" ? (sort as "price_asc" | "price_desc" | "newest" | "name") : undefined,
    });

    return res.json({ success: true, data: products });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getProductController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const productId = asParam(req.params.productId);
    const product = await storefrontService.getAllocatedProductById(siteName, productId);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    return handleError(res, error);
  }
};

export const signupController = async (req: Request, res: Response) => {
  try {
    const { siteName, email, name, password, idToken } = req.body as {
      siteName?: string;
      email?: string;
      name?: string;
      password?: string;
      idToken?: string;
    };

    if (!siteName || !name || (!idToken && (!email || !password))) {
      return res.status(400).json({
        success: false,
        message: "siteName, name and either a Firebase ID token or email/password are required",
      });
    }

    const user = await storefrontService.signupSiteUser(siteName, { email, name, password, idToken });
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    return handleError(res, error);
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const { siteName, idToken } = req.body as {
      siteName?: string;
      idToken?: string;
    };

    if (!siteName || !idToken) {
      return res.status(400).json({ success: false, message: "siteName and Firebase ID token are required" });
    }

    const user = await storefrontService.loginSiteUser(siteName, idToken);
    return res.json({ success: true, data: user });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getSiteUserController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const email = asParam(req.params.email);
    const user = await storefrontService.getSiteUser(siteName, email);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateCartController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const email = asParam(req.params.email);
    const { items } = req.body as { items?: Array<Record<string, unknown>> };

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "items array is required" });
    }

    const user = await storefrontService.updateCart(siteName, email, items);
    return res.json({ success: true, data: user });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateWishlistController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const email = asParam(req.params.email);
    const { wishlist } = req.body as { wishlist?: string[] };

    if (!Array.isArray(wishlist)) {
      return res.status(400).json({ success: false, message: "wishlist array is required" });
    }

    const user = await storefrontService.updateWishlist(siteName, email, wishlist);
    return res.json({ success: true, data: user });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateAddressesController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const email = asParam(req.params.email);
    const { savedAddresses } = req.body as { savedAddresses?: Array<Record<string, unknown>> };

    if (!Array.isArray(savedAddresses)) {
      return res.status(400).json({ success: false, message: "savedAddresses array is required" });
    }

    const user = await storefrontService.updateAddresses(siteName, email, savedAddresses);
    return res.json({ success: true, data: user });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createOrderController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const {
      customerEmail,
      customerName,
      customerPhone,
      shippingAddress,
      items,
      subtotal,
      shippingFee,
      total,
      notes,
    } = req.body as {
      customerEmail?: string;
      customerName?: string;
      customerPhone?: string;
      shippingAddress?: Record<string, unknown>;
      items?: Array<Record<string, unknown>>;
      subtotal?: number;
      shippingFee?: number;
      total?: number;
      notes?: string;
    };

    if (!customerEmail || !customerName || !customerPhone || !shippingAddress || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Missing required order fields" });
    }

    const order = await storefrontService.createSiteOrder(siteName, {
      customerEmail,
      customerName,
      customerPhone,
      shippingAddress,
      items,
      subtotal: Number(subtotal || 0),
      shippingFee: Number(shippingFee || 0),
      total: Number(total || 0),
      notes,
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getOrdersController = async (req: Request, res: Response) => {
  try {
    const siteName = asParam(req.params.siteName);
    const email = asParam(req.params.email);
    const orders = await storefrontService.getSiteUserOrders(siteName, email);
    return res.json({ success: true, data: orders });
  } catch (error) {
    return handleError(res, error);
  }
};
