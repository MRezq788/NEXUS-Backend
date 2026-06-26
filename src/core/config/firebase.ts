import "dotenv/config";
import admin from "firebase-admin";

function getPrivateKey(): string {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) {
    throw new Error("FIREBASE_PRIVATE_KEY is not set.");
  }

  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  const eqIdx = key.indexOf("=");
  if (eqIdx > 0 && key.substring(0, eqIdx).trim() === "FIREBASE_PRIVATE_KEY") {
    key = key.substring(eqIdx + 1);
  }

  key = key.replace(/\\\\r\\\\n/g, "\n").replace(/\\\\n/g, "\n").replace(/\\\\r/g, "\r");
  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  key = key.replace(/\r\n/g, "\n");

  if (
    !key.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !key.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error("FIREBASE_PRIVATE_KEY is malformed.");
  }

  if (!key.endsWith("\n")) {
    key += "\n";
  }

  return key;
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: getPrivateKey(),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
