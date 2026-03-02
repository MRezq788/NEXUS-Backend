import { Request, Response } from 'express';
import { createOrdersService, createSingleOrderService } from './order.service';

export const createOrdersController = async (
  req: Request,
  res: Response
) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        message: 'Orders array is required and cannot be empty',
      });
    }

    await createOrdersService(orders);

    return res.status(201).json({
      message: 'Orders created successfully',
    });

  } catch (error) {
    console.error('Create Orders Error:', error);

    return res.status(500).json({
      message: 'Failed to create orders',
    });
  }
};

export const createSingleOrderController = async (
  req: Request,
  res: Response
) => {
  try {
    const order = req.body;

    if (!order) {
      return res.status(400).json({
        message: 'Order body is required',
      });
    }

    const createdOrderId = await createSingleOrderService(order);

    return res.status(201).json({
      message: 'Order created successfully',
      orderId: createdOrderId,
    });

  } catch (error) {
    console.error('Create Order Error:', error);

    return res.status(500).json({
      message: 'Failed to create order',
    });
  }
};