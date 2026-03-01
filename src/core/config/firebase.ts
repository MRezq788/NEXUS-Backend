import "dotenv/config";
import admin from "firebase-admin";

const serviceAccount = require("./nexus-fc878-firebase-adminsdk-fbsvc-a746b832c2.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };