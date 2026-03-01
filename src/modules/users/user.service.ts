import * as userRepository from './user.repository';
import { CreateUserData } from './user.repository';

export const syncNewUser = async (data: CreateUserData) => {
  // Business Logic: Ensure the role is one of the allowed types
  const validRoles = ["business_owner", "warehouse", "app_User"];
  
  if (!validRoles.includes(data.role)) {
    throw new Error(`Business Logic Error: Invalid role '${data.role}'.`);
  }

  // Delegate the actual database creation to the repository
  const createdUser = await userRepository.createUserDocument(data);
  
  return createdUser;
};