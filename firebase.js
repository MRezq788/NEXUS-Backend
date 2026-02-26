// Load environment variables and import Firebase Admin SDK
import "dotenv/config";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK using environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

// Initialize Firestore and Storage
const db = admin.firestore();
const storage = admin.storage().bucket();

export { app, db, storage };
