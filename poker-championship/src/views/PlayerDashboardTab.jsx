import { useState, useMemo } from 'react';
import { doc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db, safeAppId } from '../firebase';
import { 
  User, 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Check, 
  X, 
  HandCoins, 
  Info, 
  Clock, 
  ShieldAlert, 
  LogOut,
  Wallet
} from 'lucide-react';
import { repaymentAmount, CHIP_CASE_CAPACITY, MAX_TRANSACTION_LIMIT } from '../utils/pokerEngine';

export default function PlayerDashboardTab({
  currentPlayerId,
  setCurrentPlayerId,
  config,
  sessions,
  loans,
  currentDay,
  playerStats,
  playerDeclarations
}) {
  const [buyInAmount, setBuyInAmount] = useState('');
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Loan Form State
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanLender, setLoanLender] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanInterest, setLoanInterest] = useState('10');
  const [loanDeadline, setLoanDeadline] = useState('5');

  // Find player data from config
  const player = useMemo(() => {
    return config.players.find(p => p.id === currentPlayerId);
  }, [config, currentPlayerId]);

  // Find player stats (includes lifetime net worth and rank)
  const stats = useMemo(() => {
    return playerStats.find(p => p.id === currentPlayerId);
  }, [playerStats, currentPlayerId]);

  // Active Session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.status === 'active');
  }, [sessions]);

  // Latest Completed Session for baseline balance
  const latestCompletedSession = useMemo(() => {
    return sessions.find(s => s.status !== 'active');
  }, [sessions]);

  const baselineBalance = useMemo(() => {
    return latestCompletedSession?.balances?.[currentPlayerId] ?? Number(player?.startBalance || 0);
  }, [latestCompletedSession, player, currentPlayerId]);

  // Player's declaration for today
  const declarationDocRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', currentPlayerId);

  // Read all player declarations from playerDeclarations collection
  const activeDeclaration = useMemo(() => {
    if (!activeSession) return null;
    return playerDeclarations?.[currentPlayerId] || null;
  }, [activeSession, playerDeclarations, currentPlayerId]);

  // Calculate loans issued today (only count active ones for stack calculations)
  const todayLoans = useMemo(() => {
    if (!activeSession) return [];
    return loans.filter(l => Number(l.dayIssued) === Number(activeSession.dayNumber));
  }, [loans, activeSession]);

  const { borrowedAmount, lentAmount } = useMemo(() => {
    let borrowed = 0;
    let lent = 0;
    todayLoans.forEach(l => {
      if (l.status === 'active') {
        if (l.borrower === currentPlayerId) borrowed += Number(l.amount);
        if (l.lender === currentPlayerId) lent += Number(l.amount);
      }
    });
    return { borrowedAmount: borrowed, lentAmount: lent };
  }, [todayLoans, currentPlayerId]);

  // Available Banked Balance (balance not currently in play or lent out)
  const availableBalance = useMemo(() => {
    const activeBuyIn = activeDeclaration?.buyIn || 0;
    const activeRebuys = activeDeclaration?.rebuys || 0;
    return baselineBalance + borrowedAmount - lentAmount - activeBuyIn - activeRebuys;
  }, [baselineBalance, borrowedAmount, lentAmount, activeDeclaration]);

  // Live total chips currently withdrawn from the physical case (in play)
  const totalChipsInPlay = useMemo(() => {
    return Object.values(playerDeclarations || {}).reduce((sum, dec) => {
      if (dec?.status === 'active') {
        return sum + Number(dec.buyIn || 0) + Number(dec.rebuys || 0);
      }
      return sum;
    }, 0);
  }, [playerDeclarations]);

  const remainingCaseChips = useMemo(() => {
    return Math.max(0, CHIP_CASE_CAPACITY - totalChipsInPlay);
  }, [totalChipsInPlay]);

  const maxAllowedBuyIn = useMemo(() => {
    return Math.min(availableBalance, MAX_TRANSACTION_LIMIT, remainingCaseChips);
  }, [availableBalance, remainingCaseChips]);

  const maxAllowedRebuy = useMemo(() => {
    return Math.min(availableBalance, MAX_TRANSACTION_LIMIT, remainingCaseChips);
  }, [availableBalance, remainingCaseChips]);

  const buyInHelpText = useMemo(() => {
    if (remainingCaseChips <= 0) {
      return "The physical chip case is completely empty. Other players must cash out before you can buy in.";
    }
    if (availableBalance <= 0) {
      return "You have no available bank balance to buy in. You must request a loan from another player first.";
    }
    return `You must declare a Buy-In to join the table. Each transaction is capped at ${MAX_TRANSACTION_LIMIT.toLocaleString()} chips.`;
  }, [remainingCaseChips, availableBalance]);

  // Clear messages after a delay
  const triggerMessage = (type, text) => {
    if (type === 'error') {
      setError(text);
      setSuccess('');
    } else {
      setSuccess(text);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleBuyIn = async (e) => {
    e.preventDefault();
    const amount = Number(buyInAmount);
    if (isNaN(amount) || amount <= 0) {
      triggerMessage('error', 'Please enter a valid Buy-In amount.');
      return;
    }
    if (amount > maxAllowedBuyIn) {
      if (amount > availableBalance) {
        triggerMessage('error', `Cannot buy in for more than your available balance (${availableBalance.toLocaleString()}). Request a loan if you need more.`);
      } else if (amount > MAX_TRANSACTION_LIMIT) {
        triggerMessage('error', `Cannot buy in for more than the transaction limit of ${MAX_TRANSACTION_LIMIT.toLocaleString()} chips.`);
      } else {
        triggerMessage('error', `Cannot buy in for more than the remaining chips in the physical case (${remainingCaseChips.toLocaleString()}).`);
      }
      return;
    }

    try {
      await setDoc(declarationDocRef, {
        buyIn: amount,
        rebuys: 0,
        cashOut: 0,
        status: 'active',
        timestamp: new Date().toISOString()
      });
      // Also write temporary claim to keep session lock verified
      const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', currentPlayerId);
      await updateDoc(claimRef, { timestamp: new Date().toISOString() });

      triggerMessage('success', `Successfully bought in for ${amount.toLocaleString()} chips! Pull them from the case.`);
      setBuyInAmount('');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Buy-In. Please try again.');
    }
  };

  const handleRebuy = async (e) => {
    e.preventDefault();
    const amount = Number(rebuyAmount);
    if (isNaN(amount) || amount <= 0) {
      triggerMessage('error', 'Please enter a valid Rebuy amount.');
      return;
    }
    if (amount > maxAllowedRebuy) {
      if (amount > availableBalance) {
        triggerMessage('error', `Cannot rebuy for more than your available balance (${availableBalance.toLocaleString()}). Request a loan if you need more.`);
      } else if (amount > MAX_TRANSACTION_LIMIT) {
        triggerMessage('error', `Cannot rebuy for more than the transaction limit of ${MAX_TRANSACTION_LIMIT.toLocaleString()} chips.`);
      } else {
        triggerMessage('error', `Cannot rebuy for more than the remaining chips in the physical case (${remainingCaseChips.toLocaleString()}).`);
      }
      return;
    }

    try {
      const currentRebuys = activeDeclaration?.rebuys || 0;
      const newRebuys = currentRebuys + amount;

      await setDoc(declarationDocRef, {
        ...activeDeclaration,
        rebuys: newRebuys,
        timestamp: new Date().toISOString()
      }, { merge: true });

      triggerMessage('success', `Rebuy of ${amount.toLocaleString()} chips confirmed! Pull them from the case.`);
      setRebuyAmount('');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Rebuy.');
    }
  };

  const handleCashOut = async (e) => {
    e.preventDefault();
    const amount = Number(cashOutAmount);
    if (isNaN(amount) || amount < 0) {
      triggerMessage('error', 'Please enter a valid Cash-Out amount.');
      return;
    }

    try {
      await setDoc(declarationDocRef, {
        ...activeDeclaration,
        cashOut: amount,
        status: 'cashed_out',
        timestamp: new Date().toISOString()
      }, { merge: true });

      triggerMessage('success', `Cash-Out of ${amount.toLocaleString()} chips declared! Leave your physical chips on the table for verification.`);
      setCashOutAmount('');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Cash-Out.');
    }
  };

  // Loans Handlers
  const handleRequestLoan = async (e) => {
    e.preventDefault();
    const amount = Number(loanAmount);
    if (!loanLender) {
      triggerMessage('error', 'Please select a lender.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      triggerMessage('error', 'Please enter a valid loan amount.');
      return;
    }

    try {
      const pin = localStorage.getItem('poker_player_pin') || '';
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans'), {
        borrower: currentPlayerId,
        lender: loanLender,
        amount: amount,
        interest: Number(loanInterest),
        dayIssued: Number(activeSession?.dayNumber || currentDay),
        deadlineDay: Number(activeSession?.dayNumber || currentDay) + Number(loanDeadline),
        status: 'pending',
        actionBy: currentPlayerId,
        recordedAt: new Date().toISOString(),
        recordedBy: currentPlayerId
      });

      triggerMessage('success', 'Loan request submitted! Waiting for the lender to approve.');
      setLoanAmount('');
      setLoanLender('');
      setShowLoanForm(false);
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit loan request.');
    }
  };

  const handleApproveLoan = async (loan) => {
    try {
      const sessionRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(sessionRef, {
        status: 'active'
      });
      triggerMessage('success', 'Loan approved and is now active!');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to approve loan.');
    }
  };

  const handleDeclineLoan = async (loan) => {
    if (!window.confirm("Decline and delete this loan request?")) return;
    try {
      // Direct update in firestore
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, { status: 'declined' });
      triggerMessage('success', 'Loan request declined.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestSettlement = async (loan) => {
    try {
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, {
        status: 'pending_settlement',
        settleRequestedBy: currentPlayerId
      });
      triggerMessage('success', 'Settlement requested! Waiting for the other player to confirm receipt of chips.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveSettlement = async (loan) => {
    try {
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, {
        status: 'settled',
        settledDay: Number(activeSession?.dayNumber || currentDay)
      });
      triggerMessage('success', 'Loan marked as settled!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineSettlement = async (loan) => {
    try {
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, {
        status: 'active',
        settleRequestedBy: null
      });
      triggerMessage('success', 'Settlement request declined. Loan returned to active status.');
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayerLogout = () => {
    localStorage.removeItem('poker_player_id');
    localStorage.removeItem('poker_player_pin');
    setCurrentPlayerId(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Profile/Header Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-900/60 border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-2xl shadow-lg shadow-amber-500/10">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{player?.name}</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Championship Standing: <span className="text-amber-400 font-bold">#{stats?.rank || '-'}</span> of {config.players.length}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handlePlayerLogout}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 text-sm font-semibold transition-all w-full sm:w-auto cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Dashboard</span>
            </button>
          </div>
        </div>

        {/* Balance Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-white/5 pt-6">
          <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Banked Balance</span>
            <div className="text-xl font-black text-white font-mono mt-1 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-zinc-400" />
              {baselineBalance.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Lent / Borrowed (Today)</span>
            <div className="text-xl font-black font-mono mt-1 flex items-center gap-1">
              <span className={borrowedAmount > 0 ? "text-emerald-400" : "text-zinc-400"}>+{borrowedAmount}</span>
              <span className="text-zinc-600">/</span>
              <span className={lentAmount > 0 ? "text-rose-400" : "text-zinc-400"}>-{lentAmount}</span>
            </div>
          </div>

          <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">In Play Today</span>
            <div className="text-xl font-black text-amber-400 font-mono mt-1">
              {activeDeclaration ? ((activeDeclaration.buyIn || 0) + (activeDeclaration.rebuys || 0)).toLocaleString() : '0'}
            </div>
          </div>

          <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Available Bank</span>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              {availableBalance.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Errors */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 py-3 px-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 px-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-2">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid: Game Actions (Left) and Loans (Right) */}
      <div className="grid gap-6 md:grid-cols-5">
        
        {/* Left Column: Game Lifecycle (Buy-In / Rebuy / Cash-Out) */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-zinc-900/40 border border-white/5 p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Daily Game Actions</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Declare your physical chip transactions for Day {activeSession?.dayNumber || currentDay}.</p>
            </div>

            {!activeSession ? (
              <div className="text-center py-12 bg-zinc-950/30 border border-white/5 rounded-2xl border-dashed flex flex-col items-center justify-center p-4">
                <Clock className="h-10 w-10 text-zinc-600 mb-3 animate-pulse" />
                <h4 className="font-semibold text-zinc-300 text-sm">Waiting for Session to Start</h4>
                <p className="text-zinc-500 text-xs mt-1 max-w-[280px]">The game host has not started the session yet. Wait for the host to click "Start Day".</p>
              </div>
            ) : (
              (() => {
                const status = activeDeclaration?.status;

                // Scenario 1: Not Joined
                if (!status) {
                  return (
                    <form onSubmit={handleBuyIn} className="space-y-4">
                      <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl text-xs text-amber-300 flex items-start gap-2.5">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Required Action: Buy-In</p>
                          <p className="mt-0.5 text-zinc-400">{buyInHelpText}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-zinc-950/60 border border-white/5 p-3 rounded-xl text-xs text-zinc-400 font-mono">
                        <div>
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Transaction Limit</span>
                          <span>{MAX_TRANSACTION_LIMIT.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Case Available</span>
                          <span>{remainingCaseChips.toLocaleString()} / {CHIP_CASE_CAPACITY.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Initial Buy-In Amount</label>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            required
                            disabled={maxAllowedBuyIn <= 0}
                            placeholder={maxAllowedBuyIn > 0 ? `Max allowed: ${maxAllowedBuyIn.toLocaleString()}` : "Unavailable"}
                            value={buyInAmount}
                            onChange={(e) => setBuyInAmount(e.target.value)}
                            max={maxAllowedBuyIn}
                            className="bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white w-full focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                          />
                          <button
                            type="button"
                            disabled={maxAllowedBuyIn <= 0}
                            onClick={() => setBuyInAmount(maxAllowedBuyIn.toString())}
                            className="px-4 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Max
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={maxAllowedBuyIn <= 0}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(245,158,11,0.1)] cursor-pointer disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed"
                      >
                        <Coins className="w-4 h-4" />
                        <span>Confirm Buy-In & Start Playing</span>
                      </button>
                    </form>
                  );
                }

                // Scenario 2: Active / Playing
                if (status === 'active') {
                  const currentStack = (activeDeclaration.buyIn || 0) + (activeDeclaration.rebuys || 0);
                  return (
                    <div className="space-y-6">
                      {/* Active Status Header */}
                      <div className="flex justify-between items-center bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                          <div>
                            <span className="text-xs font-bold text-emerald-400 block">Active at Table</span>
                            <span className="text-[10px] text-zinc-500 font-medium font-mono mt-0.5">Day {activeSession.dayNumber} Stack: {currentStack.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Buy-In: {activeDeclaration.buyIn}</span>
                          {activeDeclaration.rebuys > 0 && <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Rebuys: {activeDeclaration.rebuys}</span>}
                        </div>
                      </div>

                      {/* Rebuy Section */}
                      <form onSubmit={handleRebuy} className="space-y-3 p-4 bg-zinc-950/40 border border-white/5 rounded-2xl">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Need More Chips? (Rebuy)</h4>
                          <span className="text-[10px] text-zinc-500 font-mono">Case: {remainingCaseChips.toLocaleString()} left</span>
                        </div>

                        <div className="flex justify-between items-center bg-zinc-950/60 border border-white/5 p-2 rounded-xl text-[10px] text-zinc-400 font-mono">
                          <div>
                            <span className="text-zinc-500 block uppercase font-bold tracking-wider">Transaction Cap</span>
                            <span>{MAX_TRANSACTION_LIMIT.toLocaleString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500 block uppercase font-bold tracking-wider">Max Rebuy Allowed</span>
                            <span>{maxAllowedRebuy.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <input
                            type="number"
                            required
                            disabled={maxAllowedRebuy <= 0}
                            placeholder={maxAllowedRebuy > 0 ? `Max: ${maxAllowedRebuy.toLocaleString()}` : "Unavailable"}
                            value={rebuyAmount}
                            onChange={(e) => setRebuyAmount(e.target.value)}
                            max={maxAllowedRebuy}
                            className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-sm text-white w-full focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                          />
                          {maxAllowedRebuy >= 1000 && (
                            <button
                              type="button"
                              onClick={() => setRebuyAmount(Math.min(maxAllowedRebuy, 1000).toString())}
                              className="px-3 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-colors cursor-pointer"
                            >
                              1,000
                            </button>
                          )}
                          {maxAllowedRebuy > 0 && (
                            <button
                              type="button"
                              onClick={() => setRebuyAmount(maxAllowedRebuy.toString())}
                              className="px-3 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-colors cursor-pointer"
                            >
                              Max
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={maxAllowedRebuy <= 0}
                            className="px-5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Rebuy</span>
                          </button>
                        </div>
                        {maxAllowedRebuy <= 0 && (
                          <p className="text-[10px] text-amber-500/80 font-medium">
                            {remainingCaseChips <= 0 
                              ? "Cannot rebuy: The physical chip case is empty." 
                              : "Cannot rebuy: You have no available banked balance. Request a loan."}
                          </p>
                        )}
                      </form>

                      {/* Cash-Out Section */}
                      <form onSubmit={handleCashOut} className="space-y-3 p-4 bg-zinc-950/40 border border-white/5 rounded-2xl">
                        <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Ready to Leave? (Declare Cash-Out)</h4>
                        <p className="text-[10px] text-zinc-500">Count all physical chips you have right now. This is a one-way action; corrections require host assistance.</p>
                        <div className="flex gap-3">
                          <input
                            type="number"
                            required
                            placeholder="Final Chip Count"
                            value={cashOutAmount}
                            onChange={(e) => setCashOutAmount(e.target.value)}
                            className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-sm text-white w-full focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <button
                            type="submit"
                            className="px-6 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Cash Out</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                // Scenario 3: Cashed Out
                if (status === 'cashed_out') {
                  const initialBuy = activeDeclaration.buyIn || 0;
                  const rebuys = activeDeclaration.rebuys || 0;
                  const cashed = activeDeclaration.cashOut || 0;
                  const profit = cashed - (initialBuy + rebuys);
                  
                  return (
                    <div className="space-y-4 text-center py-6">
                      <div className="inline-flex bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-2.5 px-4 rounded-full text-xs font-bold items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Cash-Out Submitted successfully</span>
                      </div>
                      
                      <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-5 max-w-sm mx-auto space-y-3">
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>Buy-In + Rebuys:</span>
                          <span className="font-mono text-white">{(initialBuy + rebuys).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>Final Cash-Out:</span>
                          <span className="font-mono text-white">{cashed.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-white/5 w-full" />
                        <div className="flex justify-between text-sm font-bold">
                          <span>Net Session Return:</span>
                          <span className={`font-mono flex items-center gap-1 ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {profit >= 0 ? <ArrowUpRight className="w-4 h-4"/> : <ArrowDownRight className="w-4 h-4"/>}
                            {Math.abs(profit).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto mt-2">Leave your physical chips on the table. The host will audit and finalize everyone's score at the end of the day.</p>
                    </div>
                  );
                }
              })()
            )}
          </div>
        </div>

        {/* Right Column: Loan Center (Approval & Requests) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-zinc-900/40 border border-white/5 p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Loan Center</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Manage credit lines and approvals.</p>
              </div>
              {activeSession && (
                <button
                  onClick={() => setShowLoanForm(!showLoanForm)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/5 hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer"
                  title="Request a Loan"
                >
                  <HandCoins className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Request Loan Form */}
            {showLoanForm && (
              <form onSubmit={handleRequestLoan} className="space-y-4 p-4 bg-zinc-950/60 border border-white/10 rounded-2xl animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Request Loan</h4>
                  <button type="button" onClick={() => setShowLoanForm(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4"/></button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Select Lender</label>
                    <select
                      required
                      value={loanLender}
                      onChange={(e) => setLoanLender(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 appearance-none"
                    >
                      <option value="" disabled>Select Player...</option>
                      {config.players.filter(p => p.id !== currentPlayerId).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Amount</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Interest (%)</label>
                      <input
                        type="number"
                        required
                        value={loanInterest}
                        onChange={(e) => setLoanInterest(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Deadline (Days)</label>
                      <input
                        type="number"
                        required
                        value={loanDeadline}
                        onChange={(e) => setLoanDeadline(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Send Loan Request
                </button>
              </form>
            )}

            {/* Loan List / Approvals */}
            <div className="space-y-4 overflow-y-auto max-h-[360px] pr-1">
              
              {/* Filter pending approvals where this user is Lender or Borrower */}
              {loans.filter(l => l.status === 'pending' && (l.lender === currentPlayerId || l.borrower === currentPlayerId)).map(loan => {
                const isLender = loan.lender === currentPlayerId;
                const counterParty = isLender 
                  ? config.players.find(p => p.id === loan.borrower)?.name 
                  : config.players.find(p => p.id === loan.lender)?.name;
                
                return (
                  <div key={loan.id} className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded">
                          Approval Pending
                        </span>
                        <p className="text-xs text-zinc-300 font-medium mt-2">
                          {isLender 
                            ? `${counterParty} wants to borrow ${loan.amount.toLocaleString()} chips.`
                            : `You requested ${loan.amount.toLocaleString()} chips from ${counterParty}.`}
                        </p>
                      </div>
                      <span className="text-sm font-black text-amber-400 font-mono">
                        {loan.amount}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-zinc-500 font-medium">
                      <span>Interest: {loan.interest}% ({repaymentAmount(loan)} payback)</span>
                      <span>Day {loan.dayIssued} → {loan.deadlineDay}</span>
                    </div>

                    {isLender && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveLoan(loan)}
                          className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeclineLoan(loan)}
                          className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {!isLender && (
                      <button
                        onClick={() => handleDeclineLoan(loan)}
                        className="py-1.5 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Pending Settlements */}
              {loans.filter(l => l.status === 'pending_settlement' && (l.lender === currentPlayerId || l.borrower === currentPlayerId)).map(loan => {
                const isLender = loan.lender === currentPlayerId;
                const counterParty = isLender 
                  ? config.players.find(p => p.id === loan.borrower)?.name 
                  : config.players.find(p => p.id === loan.lender)?.name;
                const repay = repaymentAmount(loan);

                return (
                  <div key={loan.id} className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">
                          Settlement Verification
                        </span>
                        <p className="text-xs text-zinc-300 font-medium mt-2">
                          {loan.settleRequestedBy === currentPlayerId
                            ? `You declared settlement. Waiting for ${counterParty} to confirm.`
                            : `${counterParty} claims they repaid ${repay.toLocaleString()} chips to you.`}
                        </p>
                      </div>
                      <span className="text-sm font-black text-blue-400 font-mono">
                        {repay}
                      </span>
                    </div>

                    {isLender && loan.settleRequestedBy !== currentPlayerId && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveSettlement(loan)}
                          className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          Confirm Receipt
                        </button>
                        <button
                          onClick={() => handleDeclineSettlement(loan)}
                          className="flex-1 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        >
                          Decline / Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Active Loans */}
              {loans.filter(l => l.status === 'active' && (l.lender === currentPlayerId || l.borrower === currentPlayerId)).map(loan => {
                const isLender = loan.lender === currentPlayerId;
                const counterParty = isLender 
                  ? config.players.find(p => p.id === loan.borrower)?.name 
                  : config.players.find(p => p.id === loan.lender)?.name;
                const repay = repaymentAmount(loan);

                return (
                  <div key={loan.id} className="bg-zinc-950/60 border border-white/5 p-4 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isLender ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {isLender ? 'Lent Out' : 'Owed by You'}
                        </span>
                        <p className="text-xs text-zinc-300 font-medium mt-1.5">
                          {isLender ? `Repayment due from ${counterParty}` : `Owed to ${counterParty}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black font-mono block text-white">{repay}</span>
                        <span className="text-[9px] text-zinc-500 font-bold block mt-0.5">Principal: {loan.amount}</span>
                      </div>
                    </div>

                    {!isLender && (
                      <button
                        onClick={() => handleRequestSettlement(loan)}
                        className="w-full py-1.5 mt-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/5 hover:text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Declare Loan Paid/Repaid
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Empty state for loans */}
              {loans.filter(l => (l.status === 'active' || l.status === 'pending' || l.status === 'pending_settlement') && (l.lender === currentPlayerId || l.borrower === currentPlayerId)).length === 0 && (
                <div className="text-center py-8 text-zinc-600">
                  <HandCoins className="w-8 h-8 mx-auto mb-2 opacity-10" />
                  <p className="text-xs italic">No active or pending loans.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
