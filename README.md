# Poker Championship Tracker 🏆

A premium, real-time web application to track custom poker league championships. Built using **React + Vite**, styled with **Tailwind CSS**, and backed by **Firebase (Firestore & Auth)**.

This guide provides instructions on how to copy, configure, and host your own version of this tracker for your friend group.

---

## Features

* **🏆 Real-Time Leaderboard**: Tracks player net worth, table balances, poker profit/loss (P/L), and salary payout histories.
* **📅 Daily Ledger (Sessions)**: Record physical table chips at the end of each session. Calculations and salary bumps are processed automatically.
* **💸 Loan Ledger**: Track peer-to-peer debts. Settling loans automatically adjusts the table balances of the involved players.
* **🎲 Virtual Table Companion**: Host turn-by-turn digital poker games using virtual chips with blind postings and button rotations.
* **📱 Multi-Device Live Play**: Players claim their seat using a secure PIN to control actions on their own phones in real-time.
* **🔒 Admin Controls**: Authentication gates access to settings, session recording, and loan management.

---

## Setup Instructions

Follow these steps to deploy a custom copy of the tracker.

### 1. Copy the Codebase
Fork this repository to your own GitHub account or clone it locally:
```bash
git clone https://github.com/YOUR_USERNAME/PkrChmpshp.git
cd PkrChmpshp/poker-championship
```

### 2. Configure Firebase (Cloud Setup)
Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project:

1. **Add App**: Register a new **Web App** in your project settings. Copy the `firebaseConfig` object credentials.
2. **Cloud Firestore**:
   * Click **Create Database**. Start in **Test Mode** (you will deploy secure rules later).
3. **Authentication**:
   * Click **Get Started** and enable the following Sign-in providers under the **Sign-in method** tab:
     * **Anonymous** (Used by players to view the board/submit table actions).
     * **Email/Password** (Used by the Admin/Host).
4. **Create Admin Credentials**:
   * Go to **Authentication > Users** tab.
   * Click **Add User** and create an email and password for the league Host (e.g., `host@email.com`).

---

### 3. Local Environment Setup
1. In the `poker-championship` folder, copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Open the newly created `.env` file and paste in your Firebase app credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

---

### 4. Install & Run Locally
Navigate to the frontend folder and start the Vite development server:
```bash
npm install
npm run dev
```
Open the local server URL displayed in your terminal (usually `http://localhost:5173`) to test the app.

---

### 5. Deploy Security Rules
To prevent unauthorized read/write access to your database:
1. Open the [firestore.rules](firestore.rules) file from the root directory.
2. Copy its content.
3. Paste it into the **Rules** tab of your **Cloud Firestore** console in Firebase, and click **Publish**.

---

### 6. Initialize Your League
1. Open the app in your browser.
2. Click the **Lock Icon** in the top-right corner to open the Admin Sign In form.
3. Log in using the Host email and password credentials you created in the Firebase console.
4. Go to the **Settings** tab.
5. Set up your starting game rules (payday salary interval, payday bump amount) and add players to the **Roster** (giving each player a custom name and a secret 4-digit PIN).
6. Click **Save**. The app will automatically split the configurations, hide the player PINs in a secure database folder, and initialize your league!

---

## Deployment (GitHub Pages)

This project is configured to deploy directly to GitHub Pages.

1. Open `poker-championship/package.json` and update the `"homepage"` URL to point to your GitHub page:
   ```json
   "homepage": "https://YOUR_GITHUB_USERNAME.github.io/PkrChmpshp"
   ```
2. Open `poker-championship/vite.config.js` and update the base path:
   ```javascript
   base: '/PkrChmpshp/',
   ```
3. Run the deploy script to compile the files and push them to the `gh-pages` branch:
   ```bash
   npm run deploy
   ```
   *Alternatively, if you are working in the root directory, you can run `./publish.sh "Commit message"` to commit, push, build, and deploy all at once.*

---

## Deployment (Vercel)

This project is fully ready for deployment on **Vercel**. You can deploy it using one of the following methods:

### Method 1: Zero-Config Deployment (Recommended)
1. Import your repository directly into Vercel.
2. Vercel will automatically detect the root-level [vercel.json](file:///home/shlok/PkrChmpshp/vercel.json) and [package.json](file:///home/shlok/PkrChmpshp/package.json) files.
3. In your Vercel Project Settings, add the environment variables from your `.env` (refer to `.env.example`).
4. Click **Deploy**. Vercel will automatically build the `poker-championship` subdirectory and host it at the root path `/`.

### Method 2: Configure Subdirectory as Root
1. Import your repository into Vercel.
2. Under **Project Settings**, locate the **Root Directory** setting and set it to `poker-championship`.
3. In your Vercel Project Settings, add the environment variables from your `.env`.
4. Click **Deploy**.

