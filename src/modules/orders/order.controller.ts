import { Request, Response } from 'express';
import { orderService } from './order.service';
import { successResponse, errorResponse } from '../../core/utils/response';
import { OrderStatus } from './order.model';
// import { doc, collection, updateDoc, arrayUnion } from 'firebase/firestore';
// import { db } from '../../core/config/firebase';

// Extend Express Request to include userEmail
declare global {
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}

export function extractUserEmail(req: Request, res: Response, next: Function) {
  const email = req.headers['x-user-email'] as string;
  if (email) {
    req.userEmail = email;
    console.log('Request from user:', email);
  }
  next();
}

export class OrderController {
  // Helper to get email from request
  private getUserEmail(req: Request): string {
    const email = req.userEmail || req.headers['x-user-email'] as string;
    if (!email) {
      throw new Error('User email not provided');
    }
    return email;
  }

  // GET /api/orders?status=Pending
  getOrders = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const status = req.query.status as OrderStatus | undefined;

      const orders = await orderService.getOrders(userEmail, status);
      
      return successResponse(res, orders, 'Orders retrieved successfully');
    } catch (error) {
      console.error('Get orders error:', error);
      const message = error instanceof Error ? error.message : 'Failed to retrieve orders';
      return errorResponse(res, message, 500);
    }
  };

  // GET /api/orders/:id
  getOrderById = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;

      const order = await orderService.getOrderById(userEmail, id);
      
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      return successResponse(res, order, 'Order retrieved successfully');
    } catch (error) {
      console.error('Get order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to retrieve order';
      return errorResponse(res, message, 500);
    }
  };

  // POST /api/orders - Create new order
  createOrder = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const { buyer, total, status, products } = req.body;
      
      if (!buyer) {
        return errorResponse(res, 'Buyer is required', 400);
      }
      if (!products || !Array.isArray(products) || products.length === 0) {
        return errorResponse(res, 'At least one product is required', 400);
      }

      const order = await orderService.createOrder(userEmail, {
        buyer,
        total,
        status,
        products,
      });

      return successResponse(res, order, 'Order created successfully', 201);
    } catch (error) {
      console.error('Create order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create order';
      return errorResponse(res, message, 500);
    }
  };

  // PUT /api/orders/:id - Update order
  updateOrder = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;
      const { buyer, total, status, products } = req.body;

      const order = await orderService.updateOrder(userEmail, id, {
        buyer,
        total,
        status,
        products,
      });

      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      return successResponse(res, order, 'Order updated successfully');
    } catch (error) {
      console.error('Update order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to update order';
      return errorResponse(res, message, 500);
    }
  };

  // PATCH /api/orders/:id/status - Update order status only
  updateOrderStatus = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || !['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
        return errorResponse(res, 'Valid status is required (pending, processing, completed, cancelled)', 400);
      }

      const order = await orderService.updateOrderStatus(userEmail, id, status);

      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      return successResponse(res, order, 'Order status updated successfully');
    } catch (error) {
      console.error('Update order status error:', error);
      const message = error instanceof Error ? error.message : 'Failed to update order status';
      return errorResponse(res, message, 500);
    }
  };

  // DELETE /api/orders/:id - Delete order
  deleteOrder = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;
      
      const deleted = await orderService.deleteOrder(userEmail, id);
      
      if (!deleted) {
        return errorResponse(res, 'Order not found', 404);
      }

      return successResponse(res, null, 'Order deleted successfully');
    } catch (error) {
      console.error('Delete order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete order';
      return errorResponse(res, message, 500);
    }
  };

  // DELETE /api/orders/batch - Batch delete
  deleteBatch = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 'Invalid or empty ids array', 400);
      }

      const deletedCount = await orderService.deleteOrdersBatch(userEmail, ids);
      
      return successResponse(res, { deletedCount }, `${deletedCount} orders deleted successfully`);
    } catch (error) {
      console.error('Batch delete error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete orders';
      return errorResponse(res, message, 500);
    }
  };

    // POST /api/orders/:id/accept - Accept order and deduct stock
  acceptOrder = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;

      const result = await orderService.acceptOrder(userEmail, id);
      
      if (!result.success) {
        return successResponse(res, result, 'Order cannot be accepted due to insufficient stock', 200);
      }

      return successResponse(res, result, 'Order accepted and stock updated successfully');
    } catch (error) {
      console.error('Accept order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to accept order';
      return errorResponse(res, message, 500);
    }
  };

  // POST /api/orders/:id/reject - Reject order (set to Cancelled)
  rejectOrder = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;

      const order = await orderService.rejectOrder(userEmail, id);
      
      if (!order) {
        return errorResponse(res, 'Order not found', 404);
      }

      return successResponse(res, order, 'Order rejected successfully');
    } catch (error) {
      console.error('Reject order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to reject order';
      return errorResponse(res, message, 500);
    }
  };

  // GET /api/orders/stats - Get statistics
  getStats = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const stats = await orderService.getStatistics(userEmail);
      return successResponse(res, stats, 'Order statistics retrieved successfully');
    } catch (error) {
      console.error('Get order stats error:', error);
      const message = error instanceof Error ? error.message : 'Failed to retrieve order statistics';
      return errorResponse(res, message, 500);
    }
  };

  // POST /api/orders/:id/cancel - Cancel processing order and restock
  cancelOrder = async (req: Request, res: Response) => {
    try {
      const userEmail = this.getUserEmail(req);
      const id = req.params.id as string;

      const result = await orderService.cancelOrder(userEmail, id);
      
      if (!result.success) {
        return successResponse(res, result, 'Order cannot be cancelled', 200);
      }

      return successResponse(res, result, 'Order cancelled and stock restored successfully');
    } catch (error) {
      console.error('Cancel order error:', error);
      const message = error instanceof Error ? error.message : 'Failed to cancel order';
      return errorResponse(res, message, 500);
    }
  };
}

export const orderController = new OrderController();