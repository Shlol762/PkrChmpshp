export const DEFAULT_CONFIG = {
  paydayMax: 0,
  paydayThreshold: 1000,
  paydayInterval: 1, // Default to 1 to prevent division by zero
  players: [] // Kept empty so the application code is generic. New databases will start clean.
};

export const CHIP_CASE_CAPACITY = 165000;
export const MAX_TRANSACTION_LIMIT = 10000;

export function repaymentAmount(loan) {
  return Math.round(Number(loan.amount) * (1 + Number(loan.interest || 0) / 100));
}

export function calculatePaydays(dayNumber, config, rawBalances, loans) {
  // Check if it's a payday
  if (!config.paydayInterval || config.paydayInterval <= 0) return {};
  
  // Triggered at the end of the (N-1)th day's session
  const isPayday = Number(dayNumber) > 0 && (Number(dayNumber) + 1) % config.paydayInterval === 0;

  if (!isPayday) return {};

  const paydays = {};
  let totalCirculation = 0;
  const netWorths = {};
  
  config.players.forEach(p => {
    let lentOut = 0;
    let borrowed = 0;
    loans.forEach(loan => {
      if (loan.status !== 'active' && loan.status !== 'pending_settlement' && loan.status !== 'defaulted') return;
      const principal = Number(loan.amount);
      const interest = repaymentAmount(loan) - principal;
      if (loan.lender === p.id) lentOut += (principal + interest);
      if (loan.borrower === p.id) borrowed += (principal + interest);
    });
    
    let balance = Number(p.startBalance || 0);
    const balanceVal = rawBalances[p.id];
    if (balanceVal !== undefined && balanceVal !== null) {
      if (typeof balanceVal === 'object') {
        balance = Number(balanceVal.bank || 0) + Number(balanceVal.wallet || 0);
      } else {
        balance = Number(balanceVal);
      }
    }
    const nw = balance + lentOut - borrowed;
    netWorths[p.id] = nw;
    totalCirculation += nw;
  });

  let projectedCirculation = totalCirculation;
  
  config.players.forEach(p => {
    const nw = netWorths[p.id];
    let amt = 0;
    const threshold = config.paydayThreshold ?? 1000;
    const pMax = config.paydayMax ?? 0;
    
    if (nw < threshold && pMax > 0) {
      amt = Math.min(pMax, threshold - nw);
    }
    paydays[p.id] = amt;
  });

  return paydays;
}

export function calculatePlayerStats(sessions, loans, currentDay, config, balances = {}, targetRound = null, playerDeclarations = {}) {
  const activeRound = (config && config.currentRound === 2) || currentDay > 30 ? 2 : 1;
  const round = targetRound || activeRound;
  const isRound2 = round === 2;

  // Filter completed sessions for this round
  const completedSessions = sessions.filter(s => {
    if (s.status === 'active') return false;
    const sDay = Number(s.dayNumber);
    return isRound2 ? sDay > 30 : sDay <= 30;
  });

  // Filter loans for this round
  const targetLoans = loans.filter(l => {
    const lDay = Number(l.dayIssued || 0);
    return isRound2 ? lDay > 30 : lDay <= 30;
  });

  // Determine which balances to use: live for active round, snapshot for historical round
  let targetBalances = balances;
  if (round !== activeRound) {
    const latestTargetSession = completedSessions.reduce((latest, s) => {
      if (!latest || Number(s.dayNumber) > Number(latest.dayNumber)) {
        return s;
      }
      return latest;
    }, null);
    targetBalances = latestTargetSession?.balances || {};
  }

  const totalPaydays = {};
  config.players.forEach(p => { totalPaydays[p.id] = 0; });

  completedSessions.forEach(session => {
    if (session.paydaysDistributed) {
      for (const [pid, amt] of Object.entries(session.paydaysDistributed)) {
        if (totalPaydays[pid] !== undefined) {
          totalPaydays[pid] += Number(amt || 0);
        }
      }
    }
  });

  const sorted = config.players.map(player => {
    const startBalance = isRound2 
      ? Number(player.r2StartBalance !== undefined ? player.r2StartBalance : 5000) 
      : Number(player.startBalance || 0);

    let bank = startBalance;
    let wallet = 0;
    let currentTableBalance = startBalance;
    if (targetBalances[player.id] !== undefined && targetBalances[player.id] !== null) {
      const pBal = targetBalances[player.id];
      if (typeof pBal === 'object') {
        bank = Number(pBal.bank || 0);
        wallet = Number(pBal.wallet || 0);
        currentTableBalance = bank + wallet;
      } else {
        bank = Number(pBal);
        currentTableBalance = bank;
      }
    }

    // Adjust for pending cashout if looking at the active round
    if (round === activeRound && playerDeclarations && playerDeclarations[player.id]) {
      const dec = playerDeclarations[player.id];
      if (dec.status === 'cashed_out') {
        currentTableBalance += Number(dec.cashOut || 0);
      }
    }

    let lentOutPrincipal  = 0;
    let lentOutInterest   = 0;
    let borrowedPrincipal = 0;
    let borrowedInterest  = 0;

    targetLoans.forEach(loan => {
      if (loan.status !== 'active' && loan.status !== 'pending_settlement' && loan.status !== 'defaulted') return;
      const principal = Number(loan.amount);
      const interest = repaymentAmount(loan) - principal;
      if (loan.lender === player.id) {
        lentOutPrincipal += principal;
        lentOutInterest += interest;
      }
      if (loan.borrower === player.id) {
        borrowedPrincipal += principal;
        borrowedInterest += interest;
      }
    });

    // Calculate Repayment Reliability for this round
    const playerRoundLoans = loans.filter(l => 
      l.borrower === player.id &&
      ['active', 'settled', 'defaulted', 'pending_settlement'].includes(l.status) &&
      (isRound2 ? Number(l.dayIssued || 0) > 30 : Number(l.dayIssued || 0) <= 30)
    );
    const onTimeCount = playerRoundLoans.filter(l => l.status === 'settled' && Number(l.settledDay) <= Number(l.deadlineDay)).length;
    const lateCount = playerRoundLoans.filter(l => l.status === 'settled' && Number(l.settledDay) > Number(l.deadlineDay)).length;
    const defaultCount = playerRoundLoans.filter(l => l.status === 'defaulted').length;
    const overdueCount = playerRoundLoans.filter(l => l.status === 'active' && currentDay > Number(l.deadlineDay)).length;

    const totalEndedLoans = onTimeCount + lateCount + defaultCount + overdueCount;
    const loanReliability = totalEndedLoans > 0 
      ? (onTimeCount / totalEndedLoans) * 100 
      : null;

    const expectedBreakEven = startBalance + totalPaydays[player.id];
    const tablePL = (currentTableBalance - borrowedPrincipal + lentOutPrincipal) - expectedBreakEven;

    const netWorth = currentTableBalance + (lentOutPrincipal + lentOutInterest) - (borrowedPrincipal + borrowedInterest);

    return {
      ...player,
      startBalance,
      bank,
      wallet,
      currentTableBalance,
      tablePL,
      salary: totalPaydays[player.id], 
      lentOutPrincipal,
      lentOutInterest,
      borrowedPrincipal,
      borrowedInterest,
      lentOut: lentOutPrincipal + lentOutInterest,
      borrowed: borrowedPrincipal + borrowedInterest,
      loanReliability,
      netWorth
    };
  }).sort((a, b) => {
    if (b.netWorth !== a.netWorth) {
      return b.netWorth - a.netWorth;
    }
    const aBaseline = Number(a.startBalance || 0) + (a.salary || 0);
    const bBaseline = Number(b.startBalance || 0) + (b.salary || 0);
    const aPct = aBaseline === 0 ? 0 : a.tablePL / aBaseline;
    const bPct = bBaseline === 0 ? 0 : b.tablePL / bBaseline;
    return bPct - aPct;
  });

  return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
}
