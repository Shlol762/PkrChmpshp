export const DEFAULT_CONFIG = {
  maxSystemNW: 0,
  salaryAmount: 0,
  paydayInterval: 1, // Default to 1 to prevent division by zero
  players: [] // Kept empty so the application code is generic. New databases will start clean.
};

export function repaymentAmount(loan) {
  return Math.round(Number(loan.amount) * (1 + Number(loan.interest || 0) / 100));
}

export function getSystemStateAtDay(dayNumber, config) {
  let totalSalaryPerPlayer = 0;
  const initialChipPool = config.players.reduce((sum, p) => sum + Number(p.startBalance), 0);
  let amountInCirculation = initialChipPool;

  if (!config.paydayInterval || config.paydayInterval <= 0) {
    return { totalSalaryPerPlayer, amountInCirculation };
  }

  const numPaydays = Math.floor(dayNumber / config.paydayInterval);

  for (let i = 0; i < numPaydays; i++) {
    const paydayCost = config.players.length * config.salaryAmount;
    if (amountInCirculation + paydayCost <= config.maxSystemNW) {
      totalSalaryPerPlayer += config.salaryAmount;
      amountInCirculation += paydayCost;
    } else if (amountInCirculation < config.maxSystemNW) {
      const remaining = config.maxSystemNW - amountInCirculation;
      const partialSalary = Math.floor(remaining / config.players.length);
      totalSalaryPerPlayer += partialSalary;
      amountInCirculation += partialSalary * config.players.length;
      break;
    } else {
      break;
    }
  }
  return { totalSalaryPerPlayer, amountInCirculation };
}

export function calculatePlayerStats(sessions, loans, currentDay, config) {
  const latestSession = sessions.length > 0 ? sessions[0] : null;
  const { totalSalaryPerPlayer } = getSystemStateAtDay(currentDay, config);

  return config.players.map(player => {
    const currentTableBalance =
      latestSession?.balances?.[player.id] !== undefined
        ? Number(latestSession.balances[player.id])
        : Number(player.startBalance);

    const expectedBreakEven = Number(player.startBalance) + totalSalaryPerPlayer;
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
      salary: totalSalaryPerPlayer,
      lentOutPrincipal,
      lentOutInterest,
      borrowedPrincipal,
      borrowedInterest,
      lentOut: lentOutPrincipal + lentOutInterest,
      borrowed: borrowedPrincipal + borrowedInterest,
      netWorth
    };
  }).sort((a, b) => b.netWorth - a.netWorth);
}
