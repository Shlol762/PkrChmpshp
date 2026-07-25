import { doc, runTransaction, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { repaymentAmount } from './pokerEngine';

export const recordLoanIssuance = async (db, safeAppId, loanDraft, currentDay, userId, activePlayers = []) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const loansColl = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const configRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main');
    const configDoc = await transaction.get(configRef);
    if (!configDoc.exists()) throw new Error("config/main doc not found");
    const config = configDoc.data();

    const borrower = loanDraft.borrower;
    const lender = loanDraft.lender;
    const amount = Number(loanDraft.amount);

    if (borrower === lender) {
      throw new Error("Lender and Borrower cannot be the same player.");
    }

    if (isNaN(amount) || amount <= 0) {
      throw new Error("Loan amount must be a positive number.");
    }
    if (Number(loanDraft.interest || 0) < 0) {
      throw new Error("Interest rate must be non-negative.");
    }

    const cap = Number(config.paydayMax || 0);
    if (cap > 0 && amount > cap) {
      throw new Error(`Loan amount ${amount.toLocaleString()} exceeds the maximum allowed (${cap.toLocaleString()}).`);
    }

    const isLenderActive = activePlayers.includes(lender);
    const isBorrowerActive = activePlayers.includes(borrower);

    // Determine routing: wallet-wallet if both are active, else bank-bank
    const route = (isLenderActive && isBorrowerActive) ? 'wallet' : 'bank';

    const lenderBal = balances[lender] || { bank: 0, wallet: 0 };
    const borrowerBal = balances[borrower] || { bank: 0, wallet: 0 };

    const lenderSourceAmt = Number(lenderBal[route] || 0);

    if (lenderSourceAmt < amount) {
      throw new Error(`Insufficient funds: Lender ${lender} has ${lenderSourceAmt} in ${route} but needs ${amount} to issue the loan.`);
    }

    // Update balances
    balances[lender] = {
      bank: 0,
      wallet: 0,
      frozen: 0,
      ...lenderBal,
      [route]: lenderSourceAmt - amount
    };
    balances[borrower] = {
      bank: 0,
      wallet: 0,
      frozen: 0,
      ...borrowerBal,
      [route]: Number(borrowerBal[route] || 0) + amount
    };

    // Save the loan doc (we do addDoc outside the transaction or set it inside?)
    // Note: in Firestore transaction, we can write new documents using transaction.set(doc(collection))
    const newLoanRef = doc(loansColl);
    transaction.set(newLoanRef, {
      ...loanDraft,
      status: 'active',
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // Write transaction log
    transaction.set(txRef, {
      type: 'LOAN_ISSUE',
      from: { playerId: lender, account: route },
      to: { playerId: borrower, account: route },
      amount,
      sessionDay: Number(currentDay),
      sessionId: null,
      loanId: newLoanRef.id,
      note: `Loan issue: ${lender} to ${borrower} (${route} to ${route})`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // Update balances cache doc
    transaction.set(balancesRef, balances);
  });
};

export const recordLoanSettlement = async (db, safeAppId, loan, currentDay, userId, activePlayers = []) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const loanRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  const repayAmount = repaymentAmount(loan);

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const borrower = loan.borrower;
    const lender = loan.lender;

    const isLenderActive = activePlayers.includes(lender);
    const isBorrowerActive = activePlayers.includes(borrower);

    // Determine routing: wallet-wallet if both are active, else bank-bank
    const route = (isLenderActive && isBorrowerActive) ? 'wallet' : 'bank';

    const borrowerBal = balances[borrower] || { bank: 0, wallet: 0 };
    const lenderBal = balances[lender] || { bank: 0, wallet: 0 };

    const borrowerSourceAmt = Number(borrowerBal[route] || 0);

    if (borrowerSourceAmt < repayAmount) {
      throw new Error(`Insufficient funds: Borrower ${borrower} has ${borrowerSourceAmt} in ${route} but needs ${repayAmount} to settle the loan.`);
    }

    // Update balances
    balances[borrower] = {
      bank: 0,
      wallet: 0,
      frozen: 0,
      ...borrowerBal,
      [route]: borrowerSourceAmt - repayAmount
    };
    balances[lender] = {
      bank: 0,
      wallet: 0,
      frozen: 0,
      ...lenderBal,
      [route]: Number(lenderBal[route] || 0) + repayAmount
    };

    // Update loan document status
    transaction.update(loanRef, {
      status: 'settled',
      settledDay: Number(currentDay),
      settledAt: new Date().toISOString(),
      settlementType: 'manual'
    });

    // Write transaction log
    transaction.set(txRef, {
      type: 'LOAN_SETTLE',
      from: { playerId: borrower, account: route },
      to: { playerId: lender, account: route },
      amount: repayAmount,
      sessionDay: Number(currentDay),
      sessionId: null,
      loanId: loan.id,
      note: `Loan settle: ${borrower} to ${lender} (${route} to ${route})`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // Update balances cache doc
    transaction.set(balancesRef, balances);
  });
};

export const commitSessionDay = async (db, safeAppId, sessionId, ledgerDraft, paydaysToDistribute, config, day, userId, prevBalances = {}) => {
  const sessionRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', sessionId);
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const loansColl = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');

  const loansQuery = query(loansColl, where('status', 'in', ['active', 'defaulted']));
  const loansSnapshot = await getDocs(loansQuery);

  await runTransaction(db, async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);
    if (sessionDoc.exists() && sessionDoc.data().status === 'completed') {
      throw new Error("Session is already finalized and committed.");
    }
    const wasActive = sessionDoc.exists() && sessionDoc.data().status === 'active';

    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    // Load player declarations to know what they actually recorded in real-time
    const playerDeclarations = {};
    if (wasActive) {
      const decDocs = await Promise.all(
        config.players.map(p => {
          const decRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', p.id);
          return transaction.get(decRef);
        })
      );
      config.players.forEach((p, idx) => {
        const decDoc = decDocs[idx];
        if (decDoc && decDoc.exists()) {
          playerDeclarations[p.id] = decDoc.data();
        }
      });
    }

    const finalLedger = {};
    const sessionTxs = [];

    config.players.forEach(p => {
      const draft = ledgerDraft[p.id];
      if (draft && draft.played) {
        finalLedger[p.id] = {
          buyIn: draft.buyIn,
          rebuys: draft.rebuys,
          cashOut: draft.cashOut,
          status: 'cashed_out'
        };

        const playerBal = balances[p.id] || { bank: 0, wallet: 0 };
        let bank = Number(playerBal.bank || 0);
        let wallet = Number(playerBal.wallet || 0);

        // Check if there are any missing buy-ins or rebuys not recorded in real-time
        const totalAuditedBuyIn = Number(draft.buyIn || 0);
        const totalAuditedRebuys = Number(draft.rebuys || 0);
        const totalAuditedBoughtIn = totalAuditedBuyIn + totalAuditedRebuys;
        
        // Use player declarations if active, otherwise fallback to wallet (0)
        const dec = playerDeclarations[p.id];
        const alreadyBoughtIn = wasActive && dec ? (Number(dec.buyIn || 0) + Number(dec.rebuys || 0)) : wallet;

        if (totalAuditedBoughtIn > alreadyBoughtIn) {
          const missingAmount = totalAuditedBoughtIn - alreadyBoughtIn;
          
          // Deduct from bank and add to wallet
          bank -= missingAmount;
          wallet += missingAmount;

          // If the player had 0 wallet balance, it means they missed the initial buy-in completely
          if (alreadyBoughtIn === 0) {
            if (totalAuditedBuyIn > 0) {
              sessionTxs.push({
                type: 'BUY_IN',
                from: { playerId: p.id, account: 'bank' },
                to: { playerId: p.id, account: 'wallet' },
                amount: totalAuditedBuyIn,
                note: `Audit adjustment: missing buy-in for Day ${day}`
              });
            }
            if (totalAuditedRebuys > 0) {
              sessionTxs.push({
                type: 'REBUY',
                from: { playerId: p.id, account: 'bank' },
                to: { playerId: p.id, account: 'wallet' },
                amount: totalAuditedRebuys,
                note: `Audit adjustment: missing rebuy for Day ${day}`
              });
            }
          } else {
            // Otherwise, they already had some buy-in recorded, so the missing amount is a rebuy
            sessionTxs.push({
              type: 'REBUY',
              from: { playerId: p.id, account: 'bank' },
              to: { playerId: p.id, account: 'wallet' },
              amount: missingAmount,
              note: `Audit adjustment: missing rebuy for Day ${day}`
            });
          }
        }

        // Both wasActive and !wasActive must apply cashOut, CASH_OUT log, and SESSION_CLOSE log
        // Record CASH_OUT
        bank += draft.cashOut;
        sessionTxs.push({
          type: 'CASH_OUT',
          from: { playerId: p.id, account: 'wallet' },
          to: { playerId: p.id, account: 'bank' },
          amount: draft.cashOut,
        });

        // Record SESSION_CLOSE for table win/loss
        const netPlay = draft.cashOut - (draft.buyIn + draft.rebuys);
        if (netPlay > 0) {
          sessionTxs.push({
            type: 'SESSION_CLOSE',
            from: null,
            to: { playerId: p.id, account: 'wallet' },
            amount: netPlay,
          });
        } else if (netPlay < 0) {
          sessionTxs.push({
            type: 'SESSION_CLOSE',
            from: { playerId: p.id, account: 'wallet' },
            to: null,
            amount: -netPlay,
          });
        }

        // Update balances in cache memory
        balances[p.id] = { bank, wallet: 0, frozen: Number(playerBal.frozen || 0) };
      }
    });

    // 2. Distribute paydays
    Object.entries(paydaysToDistribute).forEach(([pid, amt]) => {
      const amount = Number(amt || 0);
      if (amount > 0) {
        const playerBal = balances[pid] || { bank: 0, wallet: 0, frozen: 0 };
        balances[pid] = {
          bank: Number(playerBal.bank || 0) + amount,
          wallet: Number(playerBal.wallet || 0),
          frozen: Number(playerBal.frozen || 0)
        };
        sessionTxs.push({
          type: 'PAYDAY',
          from: null,
          to: { playerId: pid, account: 'bank' },
          amount
        });
      }
    });

    // 3. Calculate poker-only balances (pre-loan activity)
    const pokerBalances = {};
    config.players.forEach(p => {
      const prevBalObj = prevBalances[p.id];
      const roundStartBal = config.currentRound === 2 
        ? Number(p.r2StartBalance !== undefined ? p.r2StartBalance : 5000) 
        : Number(p.startBalance || 0);

      // Extract bank + wallet from previous session's balance
      const prevTotal = prevBalObj
        ? (typeof prevBalObj === 'object' ? Number(prevBalObj.bank || 0) + Number(prevBalObj.wallet || 0) : Number(prevBalObj))
        : roundStartBal;

      const draft = ledgerDraft[p.id];
      const playerPlayed = draft && draft.played;
      const truePokerDiff = playerPlayed
        ? Number(draft.cashOut || 0) - Number(draft.buyIn || 0) - Number(draft.rebuys || 0)
        : 0;

      const payday = Number(paydaysToDistribute[p.id] || 0);

      pokerBalances[p.id] = {
        bank: prevTotal + truePokerDiff + payday,
        wallet: 0
      };
    });

    // 3b. Automated Overdue Loan Checking & Default Detection
    const loansList = loansSnapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    // Phase 1: Check active loans for overdue status
    loansList.forEach(loan => {
      if (loan.status === 'active' && Number(loan.deadlineDay || 0) <= Number(day)) {
        const repay = repaymentAmount(loan);
        const borrower = loan.borrower;
        const lender = loan.lender;
        
        const borrowerBal = balances[borrower] || { bank: 0, wallet: 0, frozen: 0 };
        const inHand = Number(borrowerBal.bank || 0);

        if (inHand >= repay) {
          // Can pay -> Auto-settle
          balances[borrower] = {
            ...borrowerBal,
            bank: inHand - repay
          };
          
          const lenderBal = balances[lender] || { bank: 0, wallet: 0, frozen: 0 };
          balances[lender] = {
            ...lenderBal,
            bank: Number(lenderBal.bank || 0) + repay
          };

          transaction.update(loan.ref, {
            status: 'settled',
            settledDay: Number(day),
            settledAt: new Date().toISOString(),
            settlementType: 'auto'
          });

          sessionTxs.push({
            type: 'LOAN_SETTLE',
            from: { playerId: borrower, account: 'bank' },
            to: { playerId: lender, account: 'bank' },
            amount: repay,
            loanId: loan.id,
            note: `Automated loan settle: ${borrower} to ${lender} (due Day ${loan.deadlineDay})`
          });

          // Update in local list so Phase 2 knows it is settled
          loan.status = 'settled';
          loan.settledDay = Number(day);
        } else {
          // Cannot pay -> Mark defaulted
          transaction.update(loan.ref, {
            status: 'defaulted',
            defaultedDay: Number(day)
          });

          sessionTxs.push({
            type: 'LOAN_DEFAULT',
            from: null,
            to: null,
            amount: repay,
            loanId: loan.id,
            note: `Loan default: ${borrower} failed to pay ${lender} (due Day ${loan.deadlineDay})`
          });

          loan.status = 'defaulted';
          loan.defaultedDay = Number(day);
        }
      }
    });

    // Phase 2: Post-default Frozen account logic for all defaulted loans
    const defaultedByBorrower = {};
    loansList.forEach(loan => {
      if (loan.status === 'defaulted') {
        const borrower = loan.borrower;
        if (!defaultedByBorrower[borrower]) {
          defaultedByBorrower[borrower] = [];
        }
        defaultedByBorrower[borrower].push(loan);
      }
    });

    Object.entries(defaultedByBorrower).forEach(([borrower, playerLoans]) => {
      // Sort in FIFO order
      playerLoans.sort((a, b) => {
        const timeA = a.recordedAt || '';
        const timeB = b.recordedAt || '';
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        return a.id.localeCompare(b.id);
      });

      const borrowerBal = balances[borrower] || { bank: 0, wallet: 0, frozen: 0 };
      let allocatedFrozen = Number(borrowerBal.frozen || 0);

      playerLoans.forEach(loan => {
        const repay = repaymentAmount(loan);
        const alreadyFrozenForThisLoan = Math.min(repay, allocatedFrozen);
        allocatedFrozen -= alreadyFrozenForThisLoan;

        const remaining = repay - alreadyFrozenForThisLoan;
        if (remaining > 0) {
          const inHand = Number(balances[borrower]?.bank || 0);
          const paydayAmount = Number(paydaysToDistribute[borrower] || 0);

          if (inHand >= remaining) {
            // Sub-Case 1: Crossed the limit
            balances[borrower].bank = inHand - remaining;
            balances[borrower].frozen = (balances[borrower].frozen || 0) + remaining;

            sessionTxs.push({
              type: 'FROZEN_FUNDED',
              from: { playerId: borrower, account: 'bank' },
              to: { playerId: borrower, account: 'frozen' },
              amount: remaining,
              loanId: loan.id,
              note: `Loan fully funded in frozen assets: ${borrower} (repay amount ${repay.toLocaleString()})`
            });
            allocatedFrozen += remaining;
          } else if (paydayAmount > 0) {
            // Sub-Case 2: Payday Day, borrower still below limit
            const toRedirect = Math.min(paydayAmount, remaining);
            balances[borrower].bank = Math.max(0, inHand - toRedirect);
            balances[borrower].frozen = (balances[borrower].frozen || 0) + toRedirect;

            sessionTxs.push({
              type: 'PAYDAY_FROZEN',
              from: null,
              to: { playerId: borrower, account: 'frozen' },
              amount: toRedirect,
              loanId: loan.id,
              note: `Payday redirected to frozen assets: ${borrower}`
            });
            allocatedFrozen += toRedirect;
          }
        }
      });
    });

    // 4. Write session doc status updates
    transaction.update(sessionRef, {
      status: 'completed',
      balances, // save standard balances (including settlements)
      pokerBalances, // save clean poker balances (excluding settlements)
      paydaysDistributed: paydaysToDistribute,
      ledger: finalLedger,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // 4. Update balances/main doc
    transaction.set(balancesRef, balances);

    // 5. Write all session transaction log documents
    sessionTxs.forEach(tx => {
      const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
      transaction.set(txRef, {
        sessionDay: Number(day),
        sessionId: sessionId,
        loanId: null,
        note: `Session commit Day ${day}`,
        ...tx,
        recordedAt: new Date().toISOString(),
        recordedBy: userId
      });
    });
  });
};

export const saveBalances = async (db, safeAppId, balancesDraft, config, userId) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');

  await runTransaction(db, async (transaction) => {
    const cleanedBalances = {};
    const txs = [];

    config.players.forEach(p => {
      const val = balancesDraft[p.id];
      const newAmt = val === '' ? 0 : Number(val) || 0;
      cleanedBalances[p.id] = {
        bank: newAmt,
        wallet: 0
      };

      txs.push({
        type: 'BALANCE_RESET',
        from: null,
        to: { playerId: p.id, account: 'bank' },
        amount: newAmt,
        sessionDay: 0,
        note: 'Manual administrative balance update reset'
      });
    });

    // Update balances cache
    transaction.set(balancesRef, cleanedBalances);

    // Write BALANCE_RESET transaction logs
    txs.forEach(tx => {
      const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
      transaction.set(txRef, {
        ...tx,
        recordedAt: new Date().toISOString(),
        recordedBy: userId
      });
    });
  });
};

export const recordBalanceCorrection = async (db, safeAppId, playerId, delta, note, currentDay, userId) => {
  if (isNaN(delta) || delta === 0) {
    throw new Error("Adjustment amount must be a non-zero number.");
  }
  if (!note || note.trim() === '') {
    throw new Error("A reason note is required for balance corrections.");
  }
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const playerBal = balances[playerId] || { bank: 0, wallet: 0 };
    const bank = Number(playerBal.bank || 0);
    const newBank = bank + delta;

    if (newBank < 0) {
      throw new Error(`Invalid adjustment: bank balance cannot go below 0 (current: ${bank.toLocaleString()}, adjustment: ${delta.toLocaleString()})`);
    }

    balances[playerId] = {
      ...playerBal,
      bank: newBank
    };

    transaction.set(txRef, {
      type: 'BALANCE_CORRECTION',
      from: delta < 0 ? { playerId, account: 'bank' } : null,
      to: delta > 0 ? { playerId, account: 'bank' } : null,
      amount: Math.abs(delta), // absolute amount
      sessionDay: Number(currentDay),
      sessionId: null,
      loanId: null,
      note: note.trim(),
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    transaction.set(balancesRef, balances);
  });
};

export const recordRealtimeBuyIn = async (db, safeAppId, playerId, amount, currentDay, userId) => {
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Buy-in amount must be a positive number.");
  }
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const decRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', playerId);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    // Guard: if a buy-in declaration already exists for this session,
    // reject the request. The player should use Rebuy instead.
    // This is the atomic check that prevents duplicate buy-ins even if
    // the UI button is tapped multiple times before the first completes.
    const existingDec = await transaction.get(decRef);
    if (existingDec.exists() && Number(existingDec.data().buyIn || 0) > 0) {
      throw new Error(
        `You have already bought in for ${Number(existingDec.data().buyIn).toLocaleString()} chips this session. ` +
        `Use the Rebuy option to add more chips.`
      );
    }

    const playerBal = balances[playerId] || { bank: 0, wallet: 0 };
    const bank = Number(playerBal.bank || 0);
    const wallet = Number(playerBal.wallet || 0);

    if (bank < amount) {
      throw new Error(`Insufficient funds: bank balance is ${bank.toLocaleString()} but buy-in needs ${amount.toLocaleString()}`);
    }

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
      note: `Real-time buy-in: ${playerId}`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
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
};

export const recordRealtimeRebuy = async (db, safeAppId, playerId, amount, currentDay, userId) => {
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Rebuy amount must be a positive number.");
  }
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const decRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', playerId);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const decDoc = await transaction.get(decRef);
    const decData = decDoc.exists() ? decDoc.data() : { buyIn: 0, rebuys: 0 };

    const playerBal = balances[playerId] || { bank: 0, wallet: 0 };
    const bank = Number(playerBal.bank || 0);
    const wallet = Number(playerBal.wallet || 0);

    if (bank < amount) {
      throw new Error(`Insufficient funds: bank balance is ${bank.toLocaleString()} but rebuy needs ${amount.toLocaleString()}`);
    }

    balances[playerId] = {
      bank: bank - amount,
      wallet: wallet + amount
    };

    transaction.set(txRef, {
      type: 'REBUY',
      from: { playerId, account: 'bank' },
      to: { playerId, account: 'wallet' },
      amount,
      sessionDay: Number(currentDay),
      sessionId: null,
      note: `Real-time rebuy: ${playerId}`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    transaction.set(decRef, {
      ...decData,
      rebuys: Number(decData.rebuys || 0) + amount,
      timestamp: new Date().toISOString()
    });

    transaction.set(balancesRef, balances);
  });
};

export const recordRealtimeCashOut = async (db, safeAppId, playerId, amount, currentDay, userId) => {
  if (isNaN(amount) || amount < 0) {
    throw new Error("Cash-out amount must be a non-negative number.");
  }
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const decRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', playerId);

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const decDoc = await transaction.get(decRef);
    if (!decDoc.exists()) throw new Error(`Declaration doc for ${playerId} not found`);
    const decData = decDoc.data();

    const playerBal = balances[playerId] || { bank: 0, wallet: 0 };
    const bank = Number(playerBal.bank || 0);

    balances[playerId] = {
      bank, // Keep bank balance as-is; it will be updated during host audit/commit
      wallet: 0
    };

    transaction.set(decRef, {
      ...decData,
      cashOut: amount,
      status: 'cashed_out',
      timestamp: new Date().toISOString()
    });

    transaction.set(balancesRef, balances);
  });
};

export const approveLoanRequest = async (db, safeAppId, loanId, currentDay, userId, activePlayers = []) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const loanRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loanId);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const loanDoc = await transaction.get(loanRef);
    if (!loanDoc.exists()) throw new Error("Loan document not found");
    const loan = loanDoc.data();

    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const configRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main');
    const configDoc = await transaction.get(configRef);
    if (!configDoc.exists()) throw new Error("config/main doc not found");
    const config = configDoc.data();

    const borrower = loan.borrower;
    const lender = loan.lender;
    const amount = Number(loan.amount);

    if (borrower === lender) {
      throw new Error("Lender and Borrower cannot be the same player.");
    }

    const cap = Number(config.paydayMax || 0);
    if (cap > 0 && amount > cap) {
      throw new Error(`Loan amount ${amount.toLocaleString()} exceeds the maximum allowed (${cap.toLocaleString()}).`);
    }

    const isLenderActive = activePlayers.includes(lender);
    const isBorrowerActive = activePlayers.includes(borrower);

    // Determine routing: wallet-wallet if both are active, else bank-bank
    const route = (isLenderActive && isBorrowerActive) ? 'wallet' : 'bank';

    const lenderBal = balances[lender] || { bank: 0, wallet: 0 };
    const borrowerBal = balances[borrower] || { bank: 0, wallet: 0 };

    const lenderSourceAmt = Number(lenderBal[route] || 0);

    if (lenderSourceAmt < amount) {
      throw new Error(`Insufficient funds: Lender ${lender} has ${lenderSourceAmt} in ${route} but needs ${amount} to issue the loan.`);
    }

    // Update balances
    balances[lender] = {
      bank: 0,
      wallet: 0,
      frozen: 0,
      ...lenderBal,
      [route]: lenderSourceAmt - amount
    };
    balances[borrower] = {
      bank: 0,
      wallet: 0,
      frozen: 0,
      ...borrowerBal,
      [route]: Number(borrowerBal[route] || 0) + amount
    };

    // Update loan document status
    transaction.update(loanRef, {
      status: 'active',
      dayIssued: loan.dayIssued !== undefined ? Number(loan.dayIssued) : Number(currentDay),
      deadlineDay: loan.deadlineDay !== undefined ? Number(loan.deadlineDay) : (Number(currentDay) + Number(loan.deadlineDays || 5))
    });

    // Write transaction log
    transaction.set(txRef, {
      type: 'LOAN_ISSUE',
      from: { playerId: lender, account: route },
      to: { playerId: borrower, account: route },
      amount,
      sessionDay: Number(currentDay),
      sessionId: null,
      loanId: loanId,
      note: `Loan issue: ${lender} to ${borrower} (${route} to ${route})`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // Update balances cache doc
    transaction.set(balancesRef, balances);
  });
};

export const globalResetBalancesAndBaselines = async (db, safeAppId, currentConfig, designatedAmount, userId) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const configRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main');
  const loansColl = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');

  // Query active loans before transaction
  const q = query(loansColl, where('status', '==', 'active'));
  const querySnapshot = await getDocs(q);

  await runTransaction(db, async (transaction) => {
    const cleanedBalances = {};
    const txs = [];

    // Set new r2StartBalance in currentConfig players, preserving original startBalance (Round 1)
    const updatedPlayers = currentConfig.players.map(p => ({
      ...p,
      r2StartBalance: designatedAmount
    }));

    currentConfig.players.forEach(p => {
      cleanedBalances[p.id] = {
        bank: designatedAmount,
        wallet: 0
      };

      txs.push({
        type: 'BALANCE_RESET',
        from: null,
        to: { playerId: p.id, account: 'bank' },
        amount: designatedAmount,
        sessionDay: 0,
        note: 'Global reset: balances & baselines set to designated amount (Round 2)'
      });
    });

    // Update balances cache
    transaction.set(balancesRef, cleanedBalances);

    // Update public config with PINs removed
    const publicPlayers = updatedPlayers.map(p => {
      const { pin, ...publicData } = p;
      return publicData;
    });

    const publicConfig = {
      ...currentConfig,
      players: publicPlayers,
      currentRound: 2
    };

    transaction.set(configRef, publicConfig);

    querySnapshot.docs.forEach(loanDoc => {
      transaction.update(loanDoc.ref, {
        status: 'settled',
        settledDay: 0,
        settledAt: new Date().toISOString(),
        settlementType: 'auto',
        note: (loanDoc.data().note || '') + ' (Auto-settled during Round 2 Reset)'
      });
    });

    // Write BALANCE_RESET transaction logs
    txs.forEach(tx => {
      const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
      transaction.set(txRef, {
        ...tx,
        recordedAt: new Date().toISOString(),
        recordedBy: userId
      });
    });
  });
};

export const releaseFrozenToLender = async (db, safeAppId, loan, currentDay, userId) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const loanRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const borrower = loan.borrower;
    const lender = loan.lender;

    const borrowerBal = balances[borrower] || { bank: 0, wallet: 0, frozen: 0 };
    const lenderBal = balances[lender] || { bank: 0, wallet: 0, frozen: 0 };

    const amount = Number(borrowerBal.frozen || 0);

    if (amount <= 0) {
      throw new Error(`Borrower ${borrower} has no frozen funds to release.`);
    }

    // Update balances: borrower.frozen = 0, lender.bank += amount
    balances[borrower] = {
      ...borrowerBal,
      frozen: 0
    };
    balances[lender] = {
      ...lenderBal,
      bank: Number(lenderBal.bank || 0) + amount
    };

    // Update loan document status
    transaction.update(loanRef, {
      status: 'settled',
      settledDay: Number(currentDay),
      settledAt: new Date().toISOString(),
      settlementType: 'manual'
    });

    // Write transaction log
    transaction.set(txRef, {
      type: 'FROZEN_RELEASED',
      from: { playerId: borrower, account: 'frozen' },
      to: { playerId: lender, account: 'bank' },
      amount,
      sessionDay: Number(currentDay),
      sessionId: null,
      loanId: loan.id,
      note: `Frozen funds released: ${borrower} to ${lender}`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // Update balances cache doc
    transaction.set(balancesRef, balances);
  });
};
