require("dotenv").config();
const admin = require("firebase-admin");

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not set. Add it in Render -> Environment (paste the value only, no 'FIREBASE_PRIVATE_KEY=' prefix).",
    );
  }

  console.log(
    `[firebase] raw value length=${raw.length}, head=${JSON.stringify(raw.substring(0, 80))}, tail=${JSON.stringify(raw.substring(Math.max(0, raw.length - 80)))}`,
  );

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

  const nlCount = (key.match(/\\n/g) || []).length;
  console.log(`[firebase] found ${nlCount} literal '\\n' sequences to convert`);

  key = key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  key = key.replace(/\r\n/g, "\n");

  console.log(
    `[firebase] processed key length=${key.length}, head=${JSON.stringify(key.substring(0, 80))}, tail=${JSON.stringify(key.substring(Math.max(0, key.length - 80)))}`,
  );

  if (
    !key.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !key.endsWith("-----END PRIVATE KEY-----\n") ||
    !key.includes("\n\n") === false
  ) {
    console.error(
      `[firebase] key still malformed. startsWith BEGIN=${key.startsWith("-----BEGIN PRIVATE KEY-----")}, endsWith END=${key.endsWith("-----END PRIVATE KEY-----")}`,
    );
    throw new Error(
      "FIREBASE_PRIVATE_KEY is malformed after processing. Check Render -> Environment value.",
    );
  }

  const b64body = key
    .replace("-----BEGIN PRIVATE KEY-----\n", "")
    .replace("\n-----END PRIVATE KEY-----", "");
  const decodedLen = Buffer.from(b64body, "base64").length;
  console.log(`[firebase] base64 body length=${b64body.length}, decoded=${decodedLen} bytes`);

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
