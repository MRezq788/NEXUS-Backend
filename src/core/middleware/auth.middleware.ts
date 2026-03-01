import { Request, Response, NextFunction } from 'express';
import { admin } from '../config/firebase'; 

declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
    }
  }
}

export const verifyAuthToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid Authorization header',
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Attach the decoded token to the request object
    req.user = decodedToken;
    
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
    return;
  }
};