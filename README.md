# Poker Championship Tracker 🏆

A premium, real-time web application to track custom poker league championships. Built using **React + Vite**, styled with **Tailwind CSS**, and backed by **Firebase (Firestore & Auth)**.

---

## Features

* **🏆 Real-Time Leaderboard**: Tracks player net worth, table balances, poker profit/loss (P/L), and salary payout histories. Highlights top-performing players with dynamic ranks.
* **📅 Daily Ledger (Sessions)**: Record physical table chips at the end of each session. The app calculates daily P/L per player relative to the previous day and handles salary bumps automatically.
* **💸 Loan Ledger**: Track peer-to-peer debts (Borrower, Lender, Principal, Interest Rate). Settling loans automatically adjusts table balances of the involved players.
* **🔒 Admin Controls**: Key settings (Game Rules, Player Roster) are PIN-protected to prevent unauthorized modifications.
* **⚙️ Configurable Game Rules**: Easily adjust maximum system net worth, payday salary amount, and payday intervals.

---

## Tech Stack

* **Frontend**: React (v18), Vite, Tailwind CSS (v4)
* **Icons**: Lucide React
* **Database & Auth**: Firebase Firestore & Firebase Authentication
* **Hosting**: Configured for GitHub Pages

---

## Local Development

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed.

### Installation

1. Navigate to the project directory:
   ```bash
   cd poker-championship
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server locally:
   ```bash
   npm run dev
   ```
4. Build the application for production:
   ```bash
   npm run build
   ```

---

## Deployment

This project is configured for deployment to **GitHub Pages** using the `gh-pages` package.

To deploy the latest changes to your live site, run:
```bash
npm run deploy
```
This script will automatically trigger a production build and push the built assets to the designated `gh-pages` branch.
