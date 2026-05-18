import * as admin from 'firebase-admin';
import path from 'path';

// Construct the path to your downloaded JSON key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Initialize the Admin SDK (prevents re-initialization in dev environments)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

export const adminDb = admin.firestore();