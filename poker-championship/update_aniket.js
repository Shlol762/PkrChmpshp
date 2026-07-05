import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const safeAppId = 'poker-championship-app';

async function run() {
  const docId = 'cpp941pvJtZKBCvmDgff'; // Day 30 session doc ID
  const docRef = db.doc(`artifacts/${safeAppId}/public/data/sessions/${docId}`);

  console.log(`Reading document: ${docRef.path}`);
  const doc = await docRef.get();
  if (!doc.exists) {
    console.error('Day 30 document not found in Firestore!');
    return;
  }

  const data = doc.data();
  console.log('Current AK balances on Day 30:', data.balances?.AK);

  console.log('Updating balances.AK.bank to 70810...');
  
  // Set the nested field
  await docRef.update({
    'balances.AK.bank': 70810
  });

  console.log('Success! Fetching updated document to verify...');
  const updatedDoc = await docRef.get();
  console.log('Updated AK balances on Day 30:', updatedDoc.data().balances?.AK);
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Error updating Firestore:', err);
  process.exit(1);
});
