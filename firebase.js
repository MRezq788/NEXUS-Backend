require("dotenv").config();
const admin = require("firebase-admin");

function getPrivateKey() {
  let raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not set. Add it in Render -> Environment (paste the value only, no 'FIREBASE_PRIVATE_KEY=' prefix).",
    );
  }

  console.log(
    `[firebase] raw FIREBASE_PRIVATE_KEY length=${raw.length}, head=${JSON.stringify(raw.substring(0, 80))}, tail=${JSON.stringify(raw.substring(Math.max(0, raw.length - 80)))}`,
  );

  let key = raw.trim();

  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  if (/^FIREBASE_PRIVATE_KEY\s*=/i.test(key)) {
    key = key.replace(/^FIREBASE_PRIVATE_KEY\s*=\s*/, "");
  }

  key = key.replace(/\\\\r\\\\n/g, "\n").replace(/\\\\n/g, "\n").replace(/\\\\r/g, "\r");
  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  key = key.replace(/\r\n/g, "\n");

  console.log(
    `[firebase] cleaned FIREBASE_PRIVATE_KEY length=${key.length}, head=${JSON.stringify(key.substring(0, 80))}, tail=${JSON.stringify(key.substring(Math.max(0, key.length - 80)))}`,
  );

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

  console.log(
    `[firebase] final FIREBASE_PRIVATE_KEY length=${key.length}, startsWith=${key.startsWith("-----BEGIN PRIVATE KEY-----\n")}, endsWith=${key.endsWith("-----END PRIVATE KEY-----\n")}`,
  );

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
