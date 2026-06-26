require("dotenv").config();
const admin = require("firebase-admin");

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not set. Add it in Render -> Environment (paste the value only, no 'FIREBASE_PRIVATE_KEY=' prefix).",
    );
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

  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  key = key.replace(/\r\n/g, "\n");

  if (
    !key.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !key.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is malformed. Re-paste it in Render -> Environment (value only, single line with literal '\\n' characters).",
    );
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
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const storage = admin.storage().bucket();

module.exports = { admin, db, storage };
