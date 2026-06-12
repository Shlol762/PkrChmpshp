export const DEFAULT_CONFIG = {
  paydayMax: 0,
  paydayThreshold: 1000,
  paydayInterval: 1, // Default to 1 to prevent division by zero
  players: [] // Kept empty so the application code is generic. New databases will start clean.
};

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
      if (loan.status !== 'active') return;
      const principal = Number(loan.amount);
      const interest = repaymentAmount(loan) - principal;
      if (loan.lender === p.id) lentOut += (principal + interest);
      if (loan.borrower === p.id) borrowed += (principal + interest);
    });
    
    const balance = Number(rawBalances[p.id] || 0);
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

export function calculatePlayerStats(sessions, loans, currentDay, config) {
  const completedSessions = sessions.filter(s => s.status !== 'active');
  const latestSession = completedSessions.length > 0 ? completedSessions[0] : null;

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

  return config.players.map(player => {
    const currentTableBalance =
      latestSession?.balances?.[player.id] !== undefined
        ? Number(latestSession.balances[player.id])
        : Number(player.startBalance || 0);

    const expectedBreakEven = Number(player.startBalance || 0) + totalPaydays[player.id];
    const tablePL = currentTableBalance - expectedBreakEven;

    let lentOutPrincipal  = 0;
    let lentOutInterest   = 0;
    let borrowedPrincipal = 0;
    let borrowedInterest  = 0;

    loans.forEach(loan => {
      if (loan.status !== 'active') return;
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

    const netWorth = currentTableBalance + (lentOutPrincipal + lentOutInterest) - (borrowedPrincipal + borrowedInterest);

    return {
      ...player,
      currentTableBalance,
      tablePL,
      salary: totalPaydays[player.id], 
      lentOutPrincipal,
      lentOutInterest,
      borrowedPrincipal,
      borrowedInterest,
      lentOut: lentOutPrincipal + lentOutInterest,
      borrowed: borrowedPrincipal + borrowedInterest,
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
}
