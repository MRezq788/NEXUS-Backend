import { Response } from 'express';

export function successResponse<T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function errorResponse(res: Response, message: string = 'Error', statusCode: number = 500) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

export function paginatedResponse<T>(res: Response, result: any, message: string = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    ...result,
  });
}
