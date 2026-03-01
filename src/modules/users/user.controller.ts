import { Request, Response } from 'express';
import * as userService from './user.service';

export const syncUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, role } = req.body;

    // 1. Basic HTTP Input Validation
    if (!name || !email || !role) {
      res.status(400).json({ 
        success: false, 
        message: "Missing required fields: name, email, or role." 
      });
      return;
    }

    // 2. Security Validation: Ensure the authenticated token matches the email they are trying to register
    if (req.user?.email !== email) {
      res.status(403).json({ 
        success: false, 
        message: "Forbidden: Token email does not match the requested sync email." 
      });
      return;
    }

    // 3. Call the Service (Business Logic)
    const result = await userService.syncNewUser({ name, email, role });

    // 4. Return HTTP Response
    res.status(201).json({ 
      success: true, 
      message: "User synced successfully",
      data: result 
    });

  } catch (error: any) {
    console.error("Error in syncUser controller:", error);
    
    // Catch business logic errors from the service
    if (error.message.includes('Business Logic Error')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
};