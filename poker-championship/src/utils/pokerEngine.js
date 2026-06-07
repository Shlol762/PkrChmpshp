export const DEFAULT_CONFIG = {
  maxSystemNW: 1660000, // Default fallback (e.g. 200 * 8300)
  salaryAmount: 3320,
  paydayInterval: 5,
  players: [] // Kept empty so the application code is generic. New databases will start clean.
};

export function repaymentAmount(loan) {
  return Math.round(Number(loan.amount) * (1 + Number(loan.interest || 0) / 100));
}

export function getSystemStateAtDay(dayNumber, config) {
  let totalSalaryPerPlayer = 0;
  const initialChipPool = config.players.reduce((sum, p) => sum + Number(p.startBalance), 0);
  let amountInCirculation = initialChipPool;
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

    let lentOut  = 0;
    let borrowed = 0;
    loans.forEach(loan => {
      if (loan.status !== 'active') return;
      const repay = repaymentAmount(loan);
      if (loan.lender   === player.id) lentOut  += repay;
      if (loan.borrower === player.id) borrowed += repay;
    });

    const netWorth = currentTableBalance + lentOut - borrowed;

    return {
      ...player,
      currentTableBalance,
      tablePL,
      salary: totalSalaryPerPlayer,
      lentOut,
      borrowed,
      netWorth
    };
  }).sort((a, b) => b.netWorth - a.netWorth);
}
