import { Response } from 'express';

export const success = (res: Response, data: unknown, message?: string): Response => {
  return res.status(200).json({
    success: true,
    data,
    message: message || 'Operation completed successfully',
  });
};

export const error = (res: Response, message: string, code: number = 400): Response => {
  return res.status(code).json({
    success: false,
    error: message || 'An error occurred during the operation',
  });
};
