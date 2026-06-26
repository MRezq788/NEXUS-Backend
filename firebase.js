require("dotenv").config();
const admin = require("firebase-admin");

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not set. Add it to your environment (Render -> Environment).",
    );
  }
  return key.replace(/\\n/g, "\n");
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: getPrivateKey(),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const storage = admin.storage().bucket();

module.exports = { admin, db, storage };
