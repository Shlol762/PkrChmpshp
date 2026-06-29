import { doc, runTransaction, collection, addDoc } from 'firebase/firestore';

function repaymentAmount(loan) {
  return Math.round(Number(loan.amount) * (1 + Number(loan.interest || 0) / 100));
}

export const recordLoanIssuance = async (db, safeAppId, loanDraft, currentDay, userId, activePlayers = []) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const loansColl = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

    const borrower = loanDraft.borrower;
    const lender = loanDraft.lender;
    const amount = Number(loanDraft.amount);

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
      ...lenderBal,
      [route]: lenderSourceAmt - amount
    };
    balances[borrower] = {
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
      ...borrowerBal,
      [route]: borrowerSourceAmt - repayAmount
    };
    balances[lender] = {
      ...lenderBal,
      [route]: Number(lenderBal[route] || 0) + repayAmount
    };

    // Update loan document status
    transaction.update(loanRef, {
      status: 'settled',
      settledDay: Number(currentDay)
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

export const commitSessionDay = async (db, safeAppId, sessionId, ledgerDraft, paydaysToDistribute, config, day, userId) => {
  const sessionRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', sessionId);
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');

  await runTransaction(db, async (transaction) => {
    const sessionDoc = await transaction.get(sessionRef);
    const wasActive = sessionDoc.exists() && sessionDoc.data().status === 'active';

    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

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

        if (!wasActive) {
          // Record BUY_IN
          if (draft.buyIn > 0) {
            bank -= draft.buyIn;
            wallet += draft.buyIn;
            sessionTxs.push({
              type: 'BUY_IN',
              from: { playerId: p.id, account: 'bank' },
              to: { playerId: p.id, account: 'wallet' },
              amount: draft.buyIn,
            });
          }

          // Record REBUY
          if (draft.rebuys > 0) {
            bank -= draft.rebuys;
            wallet += draft.rebuys;
            sessionTxs.push({
              type: 'REBUY',
              from: { playerId: p.id, account: 'bank' },
              to: { playerId: p.id, account: 'wallet' },
              amount: draft.rebuys,
            });
          }

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
          balances[p.id] = { bank, wallet: 0 };
        } else {
          // If it WAS active, the bank was already decremented/incremented in real-time.
          // We just need to make sure the final wallet cache is cleared to 0 (which it should be).
          balances[p.id] = { bank, wallet: 0 };
        }
      }
    });

    // 2. Distribute paydays
    Object.entries(paydaysToDistribute).forEach(([pid, amt]) => {
      const amount = Number(amt || 0);
      if (amount > 0) {
        const playerBal = balances[pid] || { bank: 0, wallet: 0 };
        balances[pid] = {
          bank: Number(playerBal.bank || 0) + amount,
          wallet: Number(playerBal.wallet || 0)
        };
        sessionTxs.push({
          type: 'PAYDAY',
          from: null,
          to: { playerId: pid, account: 'bank' },
          amount
        });
      }
    });

    // 3. Write session doc status updates
    transaction.update(sessionRef, {
      status: 'completed',
      balances, // save new schema balances
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
        ...tx,
        sessionDay: Number(day),
        sessionId: sessionId,
        loanId: null,
        note: `Session commit Day ${day}`,
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

export const recordRealtimeBuyIn = async (db, safeAppId, playerId, amount, currentDay, userId) => {
  const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
  const decRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', playerId);
  const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));

  await runTransaction(db, async (transaction) => {
    const balancesDoc = await transaction.get(balancesRef);
    if (!balancesDoc.exists()) throw new Error("balances/main doc not found");
    const balances = balancesDoc.data();

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
      bank: bank + amount,
      wallet: 0
    };

    // 1. CASH_OUT transaction
    const txRef1 = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
    transaction.set(txRef1, {
      type: 'CASH_OUT',
      from: { playerId, account: 'wallet' },
      to: { playerId, account: 'bank' },
      amount,
      sessionDay: Number(currentDay),
      sessionId: null,
      note: `Real-time cash-out: ${playerId}`,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    });

    // 2. SESSION_CLOSE transaction
    const totalInvested = Number(decData.buyIn || 0) + Number(decData.rebuys || 0);
    const netPlay = amount - totalInvested;

    if (netPlay > 0) {
      const txRef2 = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
      transaction.set(txRef2, {
        type: 'SESSION_CLOSE',
        from: null,
        to: { playerId, account: 'wallet' },
        amount: netPlay,
        sessionDay: Number(currentDay),
        sessionId: null,
        note: `Real-time table win: ${playerId}`,
        recordedAt: new Date().toISOString(),
        recordedBy: userId
      });
    } else if (netPlay < 0) {
      const txRef2 = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
      transaction.set(txRef2, {
        type: 'SESSION_CLOSE',
        from: { playerId, account: 'wallet' },
        to: null,
        amount: -netPlay,
        sessionDay: Number(currentDay),
        sessionId: null,
        note: `Real-time table loss: ${playerId}`,
        recordedAt: new Date().toISOString(),
        recordedBy: userId
      });
    }

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

    const borrower = loan.borrower;
    const lender = loan.lender;
    const amount = Number(loan.amount);

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
      ...lenderBal,
      [route]: lenderSourceAmt - amount
    };
    balances[borrower] = {
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
