import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, runTransaction, collection } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rawAppId = process.env.VITE_SAFE_APP_ID || 'poker-championship-app';
const safeAppId = rawAppId.replace(/\//g, '_');

async function runTest() {
  console.log("Signing in anonymously...");
  const userCredential = await signInAnonymously(auth);

  const playerId = 'VG';
  const amount = 1000;
  const currentDay = 35;

  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const decRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', playerId);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  console.log("Running buy-in transaction...");
  try {
    await runTransaction(db, async (transaction) => {
      const balancesDoc = await transaction.get(balancesRef);
      if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
      const balances = balancesDoc.data();

      const playerBal = balances[playerId] || { bank: 0, wallet: 0 };
      const bank = Number(playerBal.bank || 0);
      const wallet = Number(playerBal.wallet || 0);

      if (bank < amount) throw new Error("Insufficient bank balance");

      balances[playerId] = {
        bank: bank - amount,
        wallet: wallet + amount
      };

      transaction.set(txRef, {
        type: 'BUY_IN',
        from: { playerId, account: 'bank' },
        to: { playerId, account: 'wallet' },
        amount,
        sessionDay: Number(currentDay),
        sessionId: null,
        note: `Test buy-in: ${playerId}`,
        recordedAt: new Date().toISOString(),
        recordedBy: userCredential.user.uid
      });

      transaction.set(decRef, {
        buyIn: amount,
        rebuys: 0,
        cashOut: 0,
        status: 'active',
        timestamp: new Date().toISOString()
      });

      transaction.set(balancesRef, balances);
    });
    console.log("Buy-in SUCCESS!");
  } catch (err) {
    console.error("Buy-in failed:");
    console.error(err);
  }
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
