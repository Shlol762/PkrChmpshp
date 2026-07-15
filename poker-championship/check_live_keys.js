import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const rawAppId = process.env.VITE_SAFE_APP_ID || 'poker-championship-app';
const safeAppId = rawAppId.replace(/\//g, '_');

async function runCheck() {
  const balanceRef = db.doc(`artifacts/${safeAppId}/public/data/balances/main`);
  const snap = await balanceRef.get();
  if (!snap.exists) {
    console.error("balances/main doc not found");
    process.exit(1);
  }
  const before = snap.data();
  const keys = Object.keys(before);
  console.log("Database Keys count:", keys.length);
  console.log("Database Keys:", keys);
  process.exit(0);
}

runCheck().catch(err => {
  console.error(err);
  process.exit(1);
});
