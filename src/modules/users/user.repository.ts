import { admin } from '../../core/config/firebase';

const db = admin.firestore();
const usersCollection = db.collection('users');

export interface CreateUserData {
  name: string;
  email: string;
  role: string;
}

export const createUserDocument = async (userData: CreateUserData) => {
  // RULE: Force the Document ID to be the user's email
  const docRef = usersCollection.doc(userData.email); 

  const newUser = {
    name: userData.name,
    email: userData.email,
    role: userData.role,
    // RULE: Strict data initialization
    profileImageUrl: "",
    preferences: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Using .set() creates the document or overwrites it. 
  // If you want to strictly prevent overwriting an existing user on accidental double-call, 
  // you could use .create(newUser) instead, which throws if the doc already exists.
  await docRef.set(newUser);

  return { id: userData.email, ...newUser };
};