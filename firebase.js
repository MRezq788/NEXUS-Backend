require("dotenv").config();
const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "nexus-fc878-firebase-adminsdk-fbsvc-ee407f8337.json"));

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();
const storage = admin.storage().bucket();

module.exports = { app, db, storage };
