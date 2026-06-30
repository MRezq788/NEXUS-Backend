import { getAuth } from "firebase-admin/auth";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
  };
}

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "No token provided",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
};
