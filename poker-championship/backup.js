import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environmental variables (.env configuration)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Verify serviceAccountKey.json is placed in the root directory
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Error: 'serviceAccountKey.json' missing from your project root folder.");
  console.error("Please download it from Firebase Console -> Project Settings -> Service Accounts.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mirror your src/firebase.js resolution logic exactly
// If VITE_SAFE_APP_ID isn't in your .env, fallback safely to 'poker-championship-app'
const rawAppId = process.env.VITE_SAFE_APP_ID || 'poker-championship-app';
const safeAppId = rawAppId.replace(/\//g, '_');

console.log(`ℹ️ Using safeAppId namespace: "${safeAppId}"`);

// Helper function to flatten deep maps (e.g. balances, ledger metrics) into flat CSV rows
function flattenObject(obj, prefix = '') {
  let res = {};
  for (const [key, val] of Object.entries(obj)) {
    const propName = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(res, flattenObject(val, propName));
    } else {
      res[propName] = val;
    }
  }
  return res;
}

// Convert objects into compliant, cleanly separated CSV strings
function convertToCSV(dataArray) {
  if (!dataArray || dataArray.length === 0) return '';
  
  const headers = Array.from(new Set(dataArray.flatMap(item => Object.keys(item))));
  const csvRows = [];
  
  csvRows.push(headers.join(',')); // Write the header row
  
  for (const row of dataArray) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === undefined || val === null) return '""';
      
      let stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      stringVal = stringVal.replace(/"/g, '""'); // Escape inner double quotes
      
      // If data contains commas, breaks or quotes, wrap completely in tracking container quotes
      return stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') 
        ? `"${stringVal}"` 
        : stringVal;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Extract historical paths out of Firestore database and serialize to disk
async function exportCollectionToCSV(collectionPath, outputFileName) {
  try {
    console.log(`⏳ Pulling documents from: ${collectionPath}...`);
    const snapshot = await db.collection(collectionPath).get();
    
    if (snapshot.empty) {
      console.log(`⚠️ Path allocation is empty or doesn't exist: ${collectionPath}`);
      return;
    }
    
    const flattenedData = snapshot.docs.map(doc => {
      return flattenObject({ id: doc.id, ...doc.data() });
    });
    
    const csvContent = convertToCSV(flattenedData);
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const filePath = path.join(backupDir, `${outputFileName}_${new Date().toISOString().split('T')[0]}.csv`);
    fs.writeFileSync(filePath, csvContent, 'utf8');
    console.log(`✅ File backed up successfully: ${filePath}`);
  } catch (error) {
    console.error(`❌ Data export fault occurred on collection path [${collectionPath}]:`, error);
  }
}

async function runBackupPipeline() {
  console.log(`🚀 Triggering Data Survivability Pipeline for project root...`);
  
  // 1. Export sessions history data maps
  await exportCollectionToCSV(
    `artifacts/${safeAppId}/public/data/sessions`, 
    'poker_sessions'
  );
  
  // 2. Export credit line accounting registries
  await exportCollectionToCSV(
    `artifacts/${safeAppId}/public/data/loans`, 
    'poker_loans'
  );
  
  // 3. Export player activity declaration tracking
  await exportCollectionToCSV(
    `artifacts/${safeAppId}/public/data/playerDeclarations`, 
    'poker_declarations'
  );

  // 4. Export centralized spreadsheet ledger balance metrics doc
  try {
    const balanceDoc = await db.doc(`artifacts/${safeAppId}/public/data/balances/main`).get();
    if (balanceDoc.exists) {
      const flatBalances = [flattenObject({ id: 'balances_main', ...balanceDoc.data() })];
      const csvContent = convertToCSV(flatBalances);
      
      const backupDir = path.join(__dirname, 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
      
      const filePath = path.join(backupDir, `central_balances_${new Date().toISOString().split('T')[0]}.csv`);
      fs.writeFileSync(filePath, csvContent, 'utf8');
      console.log(`✅ Saved live central player balance index to: ${filePath}`);
    }
  } catch (err) {
    console.error("❌ Problem extracting metrics row from 'balances/main':", err);
  }
  
  console.log(`🏁 Complete. Secure offline copies are located inside your local /backups folder.`);
  process.exit(0);
}

runBackupPipeline();