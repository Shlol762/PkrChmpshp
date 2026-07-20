import { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, addDoc, collection, updateDoc, getDoc } from 'firebase/firestore';
import { db, safeAppId, auth } from '../firebase';
import { recordRealtimeBuyIn, recordRealtimeRebuy, recordRealtimeCashOut, approveLoanRequest, recordLoanSettlement } from '../utils/ledgerEngine';
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
  Wallet,
  Trophy,
  Play,
  Eye,
  AlertTriangle,
  Hourglass
} from 'lucide-react';
import { repaymentAmount, CHIP_CASE_CAPACITY, MAX_TRANSACTION_LIMIT } from '../utils/pokerEngine';
import { isBettingRoundComplete } from '../utils/pokerGameEngine';

export default function PlayerDashboardTab({
  currentPlayerId,
  setCurrentPlayerId,
  config,
  sessions,
  loans,
  currentDay,
  playerStats,
  playerDeclarations,
  liveGames
}) {
  const [buyInAmount, setBuyInAmount] = useState('');
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const getFriendlyErrorMessage = (rawText) => {
    const text = String(rawText || '');
    if (text.includes("permission-denied") || text.includes("Missing or insufficient permissions") || text.includes("permission check failed")) {
      return {
        title: "Database Rejected Action",
        message: "The server did not authorize this action. Please check that you entered the correct seat PIN when logging in, and that the host has started the day."
      };
    }
    if (text.includes("Insufficient funds") || text.includes("insufficient funds")) {
      if (text.includes("Lender")) {
        return {
          title: "Lender Insufficient Funds",
          message: "The lender does not have enough chips in their account (bank or wallet) to fund this loan. Please select another lender or ask them to check their balances."
        };
      }
      return {
        title: "Insufficient Funds",
        message: "You do not have enough chips in your bank account to complete this transaction. Request a loan if you need more chips."
      };
    }
    if (text.includes("physical case") || text.includes("remaining chips in the physical case")) {
      return {
        title: "Chip Case Depleted",
        message: "There are not enough chips left in the physical case to fulfill your request. Other players must cash out first, or you must talk to the host to add more chips."
      };
    }
    if (text.includes("transaction limit")) {
      return {
        title: "Transaction Limit Exceeded",
        message: "This transaction exceeds the maximum limit allowed in a single action. Please break it into smaller transactions."
      };
    }
    if (text.includes("Please select a lender")) {
      return {
        title: "Lender Required",
        message: "Please select which player you want to borrow chips from before submitting the request."
      };
    }
    if (text.includes("Please enter a valid loan amount")) {
      return {
        title: "Invalid Loan Amount",
        message: "Please specify a valid chip amount for the loan (must be greater than 0)."
      };
    }
    if (text.includes("Lender and Borrower cannot be the same")) {
      return {
        title: "Self-Loaning Blocked",
        message: "You cannot request a loan from yourself. Please choose another player as the lender."
      };
    }
    if (text.includes("exceeds the maximum allowed")) {
      return {
        title: "Loan Limit Exceeded",
        message: "This loan amount exceeds the maximum allowable limit set by the host for this round."
      };
    }
    if (text.includes("Please enter a valid Buy-In")) {
      return {
        title: "Invalid Buy-In Amount",
        message: "Please enter a valid number of chips to buy in."
      };
    }
    if (text.includes("Please enter a valid Rebuy")) {
      return {
        title: "Invalid Rebuy Amount",
        message: "Please enter a valid number of chips to rebuy."
      };
    }
    if (text.includes("already bought in")) {
      return {
        title: "Already Bought In",
        message: "You are already active in this session. If you need more chips, use the Rebuy form instead of Buy-In."
      };
    }
    if (text.includes("Please enter a valid Cash-Out")) {
      return {
        title: "Invalid Cash-Out Amount",
        message: "Please enter a valid number of chips for your cash-out declaration."
      };
    }
    return {
      title: "Operation Failed",
      message: text.replace("Failed to submit Rebuy: ", "")
                 .replace("Failed to submit Buy-In: ", "")
                 .replace("Failed to submit Cash-Out: ", "")
                 .replace("Failed to approve loan: ", "")
                 .replace("Failed to settle loan: ", "")
                 .replace("FirebaseError: ", "")
    };
  };

  const renderErrorModal = () => {
    if (!modalError) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-250"
          onClick={() => setModalError(null)}
        />
        
        {/* Modal Container */}
        <div className="bg-zinc-950 border border-red-500/20 rounded-3xl p-6 max-w-md w-full shadow-2xl z-10 relative flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-250">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex-shrink-0">
              <ShieldAlert className="w-6.5 h-6.5" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-bold text-white tracking-wide">
                {modalError.title}
              </h3>
              <p className="text-sm text-zinc-450 leading-relaxed">
                {modalError.message}
              </p>
            </div>
          </div>

          {/* Expandable Technical Details */}
          {modalError.technical && modalError.technical !== modalError.message && (
            <details className="group border border-white/5 bg-zinc-900/30 rounded-xl px-4 py-2">
              <summary className="text-[10px] text-zinc-500 hover:text-zinc-400 font-bold uppercase tracking-wider cursor-pointer list-none flex justify-between items-center select-none">
                <span>Technical Details</span>
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="text-[11px] font-mono text-zinc-500 bg-black/40 border border-white/5 rounded-lg p-3 mt-2 overflow-x-auto max-h-32 whitespace-pre-wrap select-all">
                {modalError.technical}
              </div>
            </details>
          )}

          {/* Action button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setModalError(null)}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/5 text-xs font-semibold rounded-xl transition-all cursor-pointer w-full sm:w-auto"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  };


  const getAuditUserId = () => {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      return `host:${auth.currentUser.uid}`;
    }
    return `player:${currentPlayerId}`;
  };

  // Loan Form State
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanLender, setLoanLender] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanInterest, setLoanInterest] = useState('10');
  const [loanDeadline, setLoanDeadline] = useState('5');

  // Claim Seat State
  const [claimPlayerId, setClaimPlayerId] = useState('');
  const [claimPin, setClaimPin] = useState('');
  const [claimError, setClaimError] = useState('');

  // Inline Rebuy State
  const [showInlineRebuyModal, setShowInlineRebuyModal] = useState(false);

  // Active game table selection
  const [activeTableId, setActiveTableId] = useState('');

  // Find player data from config
  const player = useMemo(() => {
    if (!currentPlayerId) return null;
    return config.players.find(p => p.id === currentPlayerId);
  }, [config, currentPlayerId]);

  // Find player stats (includes lifetime net worth and rank)
  const stats = useMemo(() => {
    if (!currentPlayerId) return null;
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
    if (!currentPlayerId) return 0;
    const val = latestCompletedSession?.balances?.[currentPlayerId];
    if (val !== undefined && val !== null) {
      return typeof val === 'object' ? Number(val.bank || 0) : Number(val);
    }
    return Number(player?.startBalance || 0);
  }, [latestCompletedSession, player, currentPlayerId]);

  // Player's declaration for today
  const declarationDocRef = useMemo(() => {
    if (!currentPlayerId) return null;
    return doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', currentPlayerId);
  }, [currentPlayerId]);

  // Read all player declarations from playerDeclarations collection
  const activeDeclaration = useMemo(() => {
    if (!activeSession || !currentPlayerId) return null;
    return playerDeclarations?.[currentPlayerId] || null;
  }, [activeSession, playerDeclarations, currentPlayerId]);

  // Calculate loans issued today (only count active ones for stack calculations)
  const todayLoans = useMemo(() => {
    const latestDay = latestCompletedSession?.dayNumber || 0;
    return loans.filter(l => Number(l.dayIssued) > Number(latestDay));
  }, [loans, latestCompletedSession]);

  const { borrowedAmount, lentAmount } = useMemo(() => {
    let borrowed = 0;
    let lent = 0;
    if (currentPlayerId) {
      todayLoans.forEach(l => {
        if (l.status === 'active') {
          if (l.borrower === currentPlayerId) borrowed += Number(l.amount);
          if (l.lender === currentPlayerId) lent += Number(l.amount);
        }
      });
    }
    return { borrowedAmount: borrowed, lentAmount: lent };
  }, [todayLoans, currentPlayerId]);

  // Available Banked Balance (balance not currently in play or lent out)
  const availableBalance = useMemo(() => {
    return stats ? Number(stats.bank || 0) : baselineBalance;
  }, [stats, baselineBalance]);

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
    return Math.max(0, Math.min(availableBalance, MAX_TRANSACTION_LIMIT, remainingCaseChips));
  }, [availableBalance, remainingCaseChips]);

  const maxAllowedRebuy = useMemo(() => {
    return Math.max(0, Math.min(availableBalance, MAX_TRANSACTION_LIMIT, remainingCaseChips));
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
      const friendly = getFriendlyErrorMessage(text);
      setModalError({
        title: friendly.title,
        message: friendly.message,
        technical: text
      });
      setError(text);
      setSuccess('');
    } else {
      setSuccess(text);
      setError('');
      setModalError(null);
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    }
  };

  // Active virtual tables
  const activeTables = useMemo(() => {
    return Object.entries(liveGames || {})
      .map(([id, data]) => ({ id, ...data }))
      .filter(t => t.active);
  }, [liveGames]);

  // Table the player is currently seated at
  const playerTable = useMemo(() => {
    if (!currentPlayerId) return null;
    return activeTables.find(t => t.players?.some(p => p.id === currentPlayerId));
  }, [activeTables, currentPlayerId]);

  // Auto-sync selected table ID
  useEffect(() => {
    if (playerTable) {
      setActiveTableId(playerTable.id);
    } else if (activeTables.length > 0 && !activeTableId) {
      setActiveTableId(activeTables[0].id);
    }
  }, [playerTable, activeTables]);

  const liveGame = useMemo(() => {
    return activeTables.find(t => t.id === activeTableId) || null;
  }, [activeTables, activeTableId]);

  const totalLivePot = useMemo(() => {
    if (!liveGame) return 0;
    return (liveGame.pot || 0) + (liveGame.players || []).reduce((sum, p) => sum + (p.currentBet || 0), 0);
  }, [liveGame]);

  const isStreetSettled = useMemo(() => {
    if (!liveGame || liveGame.stage === 'SHOWDOWN') return false;
    return isBettingRoundComplete(liveGame.players, liveGame.highestBet);
  }, [liveGame]);

  const actingPlayer = useMemo(() => {
    if (!liveGame || liveGame.actingPlayerIndex === undefined || liveGame.actingPlayerIndex === -1) return null;
    return liveGame.players[liveGame.actingPlayerIndex] || null;
  }, [liveGame]);

  const minRaiseTo = useMemo(() => {
    if (!liveGame || !actingPlayer) return 0;
    const highestBet = Number(liveGame.highestBet || 0);
    const prevHighestBet = Number(liveGame.previousHighestBet || 0);
    const bigBlind = Number(liveGame.bigBlind || 100);

    const diff = highestBet - prevHighestBet;
    const raiseDiff = Math.max(bigBlind, diff);
    const theoreticalMin = highestBet + raiseDiff;

    const maxCanRaiseTo = Number(actingPlayer.stack || 0) + Number(actingPlayer.currentBet || 0);
    return Math.min(theoreticalMin, maxCanRaiseTo);
  }, [liveGame, actingPlayer]);

  // Session History for Trend Chart
  const sessionHistory = useMemo(() => {
    if (!currentPlayerId || !player) return [];
    const completed = sessions
      .filter(s => s.status !== 'active')
      .sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber));
    
    let currentNW = Number(player.startBalance || 0);
    return completed.map(s => {
      const pDec = s.ledger?.[currentPlayerId];
      const payday = s.paydaysDistributed?.[currentPlayerId] || 0;
      
      let profit = 0;
      if (pDec) {
        const totalInvestment = Number(pDec.buyIn || 0) + Number(pDec.rebuys || 0);
        const cashOut = Number(pDec.cashOut || 0);
        profit = cashOut - totalInvestment;
      }
      
      const balVal = s.balances?.[currentPlayerId];
      const balNum = typeof balVal === 'object' && balVal !== null 
        ? Number(balVal.bank || 0) + Number(balVal.wallet || 0)
        : (balVal !== undefined && balVal !== null ? Number(balVal) : null);

      currentNW = balNum !== null ? balNum : (currentNW + profit + payday);
      
      return {
        dayNumber: s.dayNumber,
        profit,
        payday,
        netWorth: currentNW
      };
    });
  }, [sessions, currentPlayerId, player]);

  // Submit action command to liveGameCommands collection
  const submitPlayerAction = async (tableId, actionType, payload = null) => {
    if (!currentPlayerId) return;
    const pin = localStorage.getItem('poker_player_pin') || '';
    try {
      const commandsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands');
      await addDoc(commandsRef, {
        tableId: tableId,
        playerId: currentPlayerId,
        action: actionType,
        payload: payload,
        pin: pin,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Action submission error:", err);
      alert("Failed to submit action. Please verify your seat PIN.");
    }
  };

  const handleActionClick = async (actionType, payload = null) => {
    await submitPlayerAction(activeTableId, actionType, payload);
  };

  const handleInlineRebuySubmit = async (amount) => {
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
      await recordRealtimeRebuy(db, safeAppId, currentPlayerId, amount, activeSession.dayNumber, getAuditUserId());

      triggerMessage('success', `Rebuy of ${amount.toLocaleString()} chips confirmed! Stack will update shortly.`);
      setShowInlineRebuyModal(false);
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Rebuy: ' + err.message);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleBuyIn = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!declarationDocRef) return;
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

    setIsSubmitting(true);
    try {
      await recordRealtimeBuyIn(db, safeAppId, currentPlayerId, amount, activeSession.dayNumber, getAuditUserId());
      
      // Also write temporary claim to keep session lock verified
      const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', currentPlayerId);
      await setDoc(claimRef, {
        playerId: currentPlayerId,
        pin: localStorage.getItem('poker_player_pin') || '',
        uid: auth.currentUser?.uid || null,
        timestamp: new Date().toISOString()
      });

      triggerMessage('success', `Successfully bought in for ${amount.toLocaleString()} chips!`);
      setBuyInAmount('');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Buy-In: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRebuy = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
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

    setIsSubmitting(true);
    try {
      await recordRealtimeRebuy(db, safeAppId, currentPlayerId, amount, activeSession.dayNumber, getAuditUserId());

      triggerMessage('success', `Rebuy of ${amount.toLocaleString()} chips confirmed! Pull them from the case.`);
      setRebuyAmount('');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Rebuy: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashOut = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const amount = Number(cashOutAmount);
    if (isNaN(amount) || amount < 0) {
      triggerMessage('error', 'Please enter a valid Cash-Out amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordRealtimeCashOut(db, safeAppId, currentPlayerId, amount, activeSession.dayNumber, getAuditUserId());

      triggerMessage('success', `Cash-Out of ${amount.toLocaleString()} chips declared! Leave your physical chips on the table for verification.`);
      setCashOutAmount('');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit Cash-Out: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loans Handlers
  const handleRequestLoan = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const amount = Number(loanAmount);
    if (!loanLender) {
      triggerMessage('error', 'Please select a lender.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      triggerMessage('error', 'Please enter a valid loan amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans'), {
        borrower: currentPlayerId,
        lender: loanLender,
        amount: amount,
        interest: Number(loanInterest),
        dayIssued: Number(activeSession?.dayNumber || (currentDay + 1)),
        deadlineDay: Number(activeSession?.dayNumber || (currentDay + 1)) + Number(loanDeadline),
        status: 'pending',
        actionBy: currentPlayerId,
        recordedAt: new Date().toISOString(),
        recordedBy: getAuditUserId()
      });

      triggerMessage('success', 'Loan request submitted! Waiting for the lender to approve.');
      setLoanAmount('');
      setLoanLender('');
      setShowLoanForm(false);
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to submit loan request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveLoan = async (loan) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const activePlayers = activeSession
        ? Object.entries(playerDeclarations || {}).filter(([, d]) => d?.status === 'active').map(([id]) => id)
        : [];
      await approveLoanRequest(
        db,
        safeAppId,
        loan.id,
        activeSession?.dayNumber || (currentDay + 1),
        getAuditUserId(),
        activePlayers
      );

      triggerMessage('success', 'Loan approved and is now active!');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to approve loan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineLoan = async (loan) => {
    if (isSubmitting) return;
    if (!window.confirm("Decline and delete this loan request?")) return;
    setIsSubmitting(true);
    try {
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, { status: 'declined' });
      triggerMessage('success', 'Loan request declined.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestSettlement = async (loan) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, {
        status: 'pending_settlement',
        settleRequestedBy: currentPlayerId
      });
      triggerMessage('success', 'Settlement requested! Waiting for the other player to confirm receipt of chips.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSettlement = async (loan) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const activePlayers = activeSession
        ? Object.entries(playerDeclarations || {}).filter(([, d]) => d?.status === 'active').map(([id]) => id)
        : [];
      await recordLoanSettlement(
        db,
        safeAppId,
        loan,
        activeSession?.dayNumber || (currentDay + 1),
        getAuditUserId(),
        activePlayers
      );

      triggerMessage('success', 'Loan marked as settled!');
    } catch (err) {
      console.error(err);
      triggerMessage('error', 'Failed to settle loan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineSettlement = async (loan) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const loanDoc = doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id);
      await updateDoc(loanDoc, {
        status: 'active',
        settleRequestedBy: null
      });
      triggerMessage('success', 'Settlement request declined. Loan returned to active status.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayerLogout = () => {
    localStorage.removeItem('poker_player_id');
    localStorage.removeItem('poker_player_pin');
    setCurrentPlayerId(null);
    window.location.reload();
  };

  // ── Chart hover state ──────────────────────────────────────────────────────
  const [hoveredChartDay, setHoveredChartDay] = useState(null);
  const [chartMousePos, setChartMousePos] = useState({ x: 0, y: 0 });

  const renderTrendChart = () => {
    if (sessionHistory.length === 0) {
      return (
        <div className="bg-zinc-950/40 p-5 rounded-2xl border border-white/5 text-zinc-500 italic text-xs text-center py-8">
          No session history to display yet. Complete and commit a session to see your net worth trend.
        </div>
      );
    }

    // Data: prepend day 0 at startBalance, then each session's netWorth
    const data = [
      { dayNumber: 0, netWorth: Number(player?.startBalance || 0) },
      ...sessionHistory
    ];

    // Chart dimensions (SVG coordinate space)
    const cW = 800;
    const cH = 320;
    const mg = { top: 24, right: 24, bottom: 40, left: 70 };

    const allDayNums = data.map(d => d.dayNumber);
    const allNWs = data.map(d => d.netWorth);

    const minDay = Math.min(...allDayNums);
    const maxDay = Math.max(...allDayNums, 1);
    const rawMin = Math.min(...allNWs);
    const rawMax = Math.max(...allNWs);
    const nwPad = (rawMax - rawMin) * 0.15 || 500;
    const yMin = rawMin - nwPad;
    const yMax = rawMax + nwPad;

    const getX = (day) =>
      mg.left + ((day - minDay) / (maxDay - minDay || 1)) * (cW - mg.left - mg.right);
    const getY = (val) =>
      cH - mg.bottom - ((val - yMin) / (yMax - yMin || 1)) * (cH - mg.top - mg.bottom);

    // Smooth bezier path
    const pts = data.map(d => ({ x: getX(d.dayNumber), y: getY(d.netWorth) }));
    let linePath = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const t = 0.2;
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;
      linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    // Area fill path: go down to baseline, back to start
    const baseline = getY(rawMin - nwPad * 0.5);
    const areaPath = `${linePath} L ${pts[pts.length - 1].x},${baseline} L ${pts[0].x},${baseline} Z`;

    // Y-axis grid lines (5 ticks)
    const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));

    // Hover handlers
    const handleChartMove = (e) => {
      const svgEl = e.currentTarget;
      const rect = svgEl.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (cW / rect.width);
      const mouseY = (e.clientY - rect.top) * (cH / rect.height);
      if (mouseX < mg.left - 10 || mouseX > cW - mg.right + 10) {
        setHoveredChartDay(null);
        return;
      }
      let closest = null;
      let minDist = Infinity;
      data.forEach(d => {
        const dist = Math.abs(getX(d.dayNumber) - mouseX);
        if (dist < minDist) { minDist = dist; closest = d; }
      });
      setHoveredChartDay(closest);
      setChartMousePos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10 });
    };

    const hoveredPt = hoveredChartDay
      ? pts[data.findIndex(d => d.dayNumber === hoveredChartDay.dayNumber)]
      : null;

    const isUp = data[data.length - 1].netWorth >= (player?.startBalance || 0);

    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 relative">
        <div className="flex items-center justify-between">
          <h3 className="text-sm uppercase font-bold text-zinc-400 tracking-wider">Net Worth Progression</h3>
          <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg ${isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {isUp ? '▲' : '▼'} {data[data.length - 1].netWorth.toLocaleString()}
          </span>
        </div>

        {/* Hover tooltip */}
        {hoveredChartDay && (
          <div
            className="absolute z-50 bg-[#09090b]/95 border border-white/10 rounded-xl p-3 shadow-2xl text-xs pointer-events-none backdrop-blur-md min-w-[160px]"
            style={{ left: chartMousePos.x, top: chartMousePos.y }}
          >
            <div className="font-bold border-b border-white/10 pb-1.5 mb-1.5 text-zinc-400 flex justify-between">
              <span>{hoveredChartDay.dayNumber === 0 ? 'Start' : `Day ${hoveredChartDay.dayNumber}`}</span>
              <span className="font-mono text-white">{hoveredChartDay.netWorth.toLocaleString()}</span>
            </div>
            {hoveredChartDay.dayNumber > 0 && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-zinc-500">Session P&amp;L</span>
                <span className={`font-mono font-bold ${(hoveredChartDay.profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(hoveredChartDay.profit || 0) >= 0 ? '+' : ''}{(hoveredChartDay.profit || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="relative aspect-[8/3.5] w-full min-h-[200px]">
          <svg
            viewBox={`0 0 ${cW} ${cH}`}
            className="w-full h-full overflow-visible"
            onMouseMove={handleChartMove}
            onMouseLeave={() => setHoveredChartDay(null)}
          >
            <defs>
              <linearGradient id="dashboardChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Y-axis grid lines + labels */}
            {yTicks.map((val, i) => {
              const y = getY(val);
              return (
                <g key={`ytick-${i}`}>
                  <line
                    x1={mg.left} y1={y}
                    x2={cW - mg.right} y2={y}
                    stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                  />
                  <text
                    x={mg.left - 10} y={y + 4}
                    textAnchor="end"
                    className="fill-zinc-600 font-mono"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {Math.round(val).toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* X-axis day labels */}
            {data.map((d) => {
              const x = getX(d.dayNumber);
              return (
                <g key={`xtick-${d.dayNumber}`}>
                  <line
                    x1={x} y1={mg.top}
                    x2={x} y2={cH - mg.bottom}
                    stroke="rgba(255,255,255,0.03)" strokeWidth="1"
                  />
                  <text
                    x={x} y={cH - mg.bottom + 18}
                    textAnchor="middle"
                    className="fill-zinc-600 font-mono"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {d.dayNumber === 0 ? 'Start' : `D${d.dayNumber}`}
                  </text>
                </g>
              );
            })}

            {/* Area gradient fill */}
            <path d={areaPath} fill="url(#dashboardChartGradient)" />

            {/* Bezier line */}
            <path
              d={linePath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover guideline + dot */}
            {hoveredChartDay && hoveredPt && (
              <g>
                <line
                  x1={hoveredPt.x} y1={mg.top}
                  x2={hoveredPt.x} y2={cH - mg.bottom}
                  stroke="rgba(255,255,255,0.2)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                <circle
                  cx={hoveredPt.x} cy={hoveredPt.y}
                  r="5"
                  fill="#f59e0b"
                  stroke="#09090b"
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Always-visible dots on each data point */}
            {!hoveredChartDay && pts.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x} cy={pt.y}
                r="3.5"
                fill="#09090b"
                stroke="#f59e0b"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>

        {/* Bottom legend row */}
        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono pt-1 border-t border-white/5">
          <span>Start: <span className="text-zinc-300 font-bold">{Number(player?.startBalance || 0).toLocaleString()}</span></span>
          <span>{sessionHistory.length} session{sessionHistory.length !== 1 ? 's' : ''}</span>
          <span>Current: <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{data[data.length - 1].netWorth.toLocaleString()}</span></span>
        </div>
      </div>
    );
  };


  const renderLoanCenter = () => {
    return (
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
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
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
              disabled={isSubmitting}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'Send Loan Request'}
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
                    className="w-full py-1.5 bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
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

          {/* Active / Defaulted Loans */}
          {loans.filter(l => (l.status === 'active' || l.status === 'defaulted') && (l.lender === currentPlayerId || l.borrower === currentPlayerId)).map(loan => {
            const isLender = loan.lender === currentPlayerId;
            const counterParty = isLender 
              ? config.players.find(p => p.id === loan.borrower)?.name 
              : config.players.find(p => p.id === loan.lender)?.name;
            const repay = repaymentAmount(loan);

            return (
              <div key={loan.id} className="bg-zinc-950/60 border border-white/5 p-4 rounded-2xl flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      loan.status === 'defaulted'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : isLender ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {loan.status === 'defaulted' ? 'Defaulted' : isLender ? 'Lent Out' : 'Owed by You'}
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

                {!isLender && loan.status !== 'defaulted' && (
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
          {loans.filter(l => (l.status === 'active' || l.status === 'defaulted' || l.status === 'pending' || l.status === 'pending_settlement') && (l.lender === currentPlayerId || l.borrower === currentPlayerId)).length === 0 && (
            <div className="text-center py-8 text-zinc-600">
              <HandCoins className="w-8 h-8 mx-auto mb-2 opacity-10" />
              <p className="text-xs italic">No active or pending loans.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Claim Seat State (If currentPlayerId === null) ──
  if (!currentPlayerId) {
    return (
      <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-500 py-8">
        <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl relative">
          <div className="text-center">
            <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white tracking-tight">Claim Your Seat</h2>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Select your name and enter your player PIN to control your actions on this phone.
            </p>
          </div>

          {claimError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{claimError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Choose Player</label>
              <select
                value={claimPlayerId}
                onChange={(e) => {
                  setClaimPlayerId(e.target.value);
                  setClaimError('');
                }}
                className="bg-zinc-950 border border-white/10 rounded-xl py-2.5 px-4 text-zinc-200 text-sm font-semibold w-full focus:outline-none focus:border-amber-500/50 cursor-pointer appearance-none animate-none"
              >
                <option value="">Select your name...</option>
                {config.players.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Enter Your PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={claimPin}
                onChange={(e) => {
                  setClaimPin(e.target.value.replace(/\D/g, ''));
                  setClaimError('');
                }}
                className="bg-zinc-950 border border-white/10 rounded-xl py-2.5 px-4 text-zinc-200 font-mono text-center text-lg tracking-widest w-full focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <button
              onClick={async () => {
                if (!claimPlayerId) {
                  setClaimError("Please select a player.");
                  return;
                }
                setClaimError("");
                try {
                  const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', claimPlayerId);
                  await setDoc(claimRef, {
                    playerId: claimPlayerId,
                    pin: claimPin,
                    uid: auth.currentUser?.uid || null,
                    timestamp: new Date().toISOString()
                  });
                  setCurrentPlayerId(claimPlayerId);
                  localStorage.setItem('poker_player_id', claimPlayerId);
                  localStorage.setItem('poker_player_pin', claimPin);
                } catch (err) {
                  console.error("Verification error:", err);
                  setClaimError("Incorrect PIN. Please ask the host for your PIN.");
                }
              }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-3 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] text-sm cursor-pointer"
            >
              Confirm & Unlock Seat
            </button>
          </div>
        </div>
        {renderErrorModal()}
      </div>
    );
  }

  // ── Active Game State (If currentPlayerId is set and a live table is active) ──
  if (activeTables.length > 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Profile / Header Card */}
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

        {/* Table Selector Tabs */}
        {activeTables.length > 1 && (
          <div className="flex gap-2 bg-zinc-950/60 p-1.5 rounded-2xl border border-white/5">
            {activeTables.map(table => {
              const isActive = table.id === activeTableId;
              const playerCount = table.players?.length || 0;
              const tableName = table.id === 'main' ? 'Table 1' : `Table ${table.id.split('_')[1] || table.id}`;
              
              return (
                <button
                  key={table.id}
                  onClick={() => setActiveTableId(table.id)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-amber-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  <span>{tableName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isActive ? 'bg-amber-600 text-amber-100' : 'bg-zinc-800 text-zinc-500'}`}>
                    {playerCount} Players
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Player seat identification / Spectator warning badge */}
        {playerTable ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 px-4 rounded-2xl flex items-center justify-between gap-2.5 text-sm font-semibold">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Playing as: <strong className="text-white">{player?.name}</strong> at {playerTable.id === 'main' ? 'Table 1' : `Table ${playerTable.id.split('_')[1] || playerTable.id}`}</span>
            </div>
            <div className="flex items-center gap-2">
              {activeTables.length > 1 && playerTable.id !== activeTableId && (
                <button
                  onClick={() => setActiveTableId(playerTable.id)}
                  className="text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold border border-amber-500/20"
                >
                  Go to my Table
                </button>
              )}
              {activeTables.length > 1 && (() => {
                const otherTable = activeTables.find(t => t.id !== playerTable.id);
                if (otherTable) {
                  const otherTableName = otherTable.id === 'main' ? 'Table 1' : `Table ${otherTable.id.split('_')[1] || otherTable.id}`;
                  return (
                    <button
                      onClick={() => handleActionClick('SWAP_TABLE', { targetTableId: otherTable.id })}
                      className="text-xs text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold border border-white/5"
                    >
                      Swap to {otherTableName}
                    </button>
                  );
                }
              })()}
              <button
                onClick={() => {
                  setShowInlineRebuyModal(true);
                }}
                className="text-xs text-amber-950 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1 cursor-pointer animate-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Rebuy</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 py-3 px-4 rounded-2xl flex items-center justify-between gap-2.5 text-sm font-semibold">
            <div className="flex items-center gap-2.5">
              <Eye className="w-5 h-5 text-amber-400" />
              <span>Spectating: <strong className="text-white">{config.players.find(p => p.id === currentPlayerId)?.name} (Read Only)</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {activeDeclaration ? (
                <button
                  onClick={() => handleActionClick('SWAP_TABLE', { targetTableId: activeTableId })}
                  className="text-xs text-amber-950 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer border border-transparent"
                >
                  Join This Table
                </button>
              ) : (
                <span className="text-xs text-zinc-500 italic">Buy in below to join the game</span>
              )}
            </div>
          </div>
        )}

        {liveGame && (
          <>
            {/* Embedded Table Board Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Hand Number</span>
                <span className="text-xl font-bold text-white">#{liveGame.handNumber}</span>
              </div>
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Stage</span>
                <span className="text-xl font-bold text-amber-400">{liveGame.stage?.replace('_', ' ')}</span>
              </div>
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Current Pot</span>
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{totalLivePot.toLocaleString()}</span>
              </div>
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">To Call</span>
                <span className="text-xl font-bold text-white tabular-nums">{liveGame.highestBet.toLocaleString()}</span>
              </div>
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between col-span-2 md:col-span-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Blinds</span>
                <span className="text-xl font-bold text-zinc-300 font-mono">{liveGame.smallBlind}/{liveGame.bigBlind}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Turn Actions Panel — always rendered, dimmed when not player's turn */}
              <div className="lg:col-span-4 space-y-4">
                {liveGame.stage !== 'SHOWDOWN' ? (() => {
                  const isMyTurn = currentPlayerId && actingPlayer && actingPlayer.id === currentPlayerId;
                  // Find the player at the table (may not be seated)
                  const myPlayerInGame = liveGame.players?.find(p => p.id === currentPlayerId) || null;
                  const displayPlayer = isMyTurn ? actingPlayer : (myPlayerInGame || actingPlayer);

                  return (
                    <div className={`bg-zinc-900/40 border rounded-3xl p-5 space-y-4 transition-all duration-300 ${
                      isMyTurn
                        ? 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]'
                        : 'border-white/5'
                    }`}>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500">
                          {isMyTurn ? 'Your Turn to Act' : 'Action Controls'}
                        </h3>
                        {!isMyTurn && (
                          <span className="text-[10px] text-zinc-600 font-semibold italic">
                            {actingPlayer ? `${actingPlayer.name}'s turn` : isStreetSettled ? 'Street settled' : 'Waiting...'}
                          </span>
                        )}
                        {isMyTurn && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        )}
                      </div>
                      {displayPlayer ? (
                        <div className={`transition-opacity duration-300 ${isMyTurn ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
                          <ActionControlPanel
                            key={displayPlayer.id}
                            actingPlayer={displayPlayer}
                            minRaiseTo={minRaiseTo}
                            totalLivePot={totalLivePot}
                            handleAction={handleActionClick}
                            liveGame={liveGame}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-4 text-zinc-600 italic text-sm">
                          No active player
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 text-center py-6 text-zinc-500 italic text-sm">
                    Showdown in progress. Waiting for host to award the pot...
                  </div>
                )}

                {/* Account balance quick card */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-3 text-xs">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider border-b border-white/5 pb-1.5 mb-1 text-center">
                    Physical Chips (Not Net Worth)
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 font-medium">
                    <span>End of Prev Day:</span>
                    <span className="font-mono font-bold text-zinc-200">{baselineBalance.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400 font-medium">
                    <span>Available Bank:</span>
                    <span className="font-mono font-bold text-emerald-400">{availableBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Seats Grid */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 relative min-h-[300px] flex flex-col justify-between">
                  <div className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-4 pb-2 border-b border-white/5 flex justify-between items-center z-10">
                    <span>Table Seats ({liveGame.id === 'main' ? 'Table 1' : `Table ${liveGame.id.split('_')[1] || liveGame.id}`})</span>
                    <span className="font-mono text-zinc-600">Active: {liveGame.players?.filter(p => !p.outOfChips && !p.folded).length}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10">
                    {liveGame.players?.map((p, idx) => {
                      const isDealer = idx === liveGame.dealerIndex;
                      const isActing = idx === liveGame.actingPlayerIndex;
                      
                      let blindLabel = "";
                      const activeCount = liveGame.players.filter(lp => !lp.outOfChips).length;
                      const activeIdxs = [];
                      for (let i = 1; i <= liveGame.players.length; i++) {
                        const checkIdx = (liveGame.dealerIndex + i) % liveGame.players.length;
                        if (!liveGame.players[checkIdx].outOfChips) {
                          activeIdxs.push(checkIdx);
                        }
                      }

                      if (activeCount === 2) {
                        if (idx === liveGame.dealerIndex) blindLabel = "SB";
                        else if (idx === activeIdxs[0]) blindLabel = "BB";
                      } else if (activeCount > 2) {
                        if (idx === activeIdxs[0]) blindLabel = "SB";
                        else if (idx === activeIdxs[1]) blindLabel = "BB";
                      }

                      let cardClass = "bg-zinc-900/50 border-white/5";
                      if (p.folded) cardClass = "bg-zinc-950/20 border-white/5 opacity-40";
                      else if (p.isAllIn) cardClass = "bg-rose-500/5 border-rose-500/20 text-rose-400";
                      else if (isActing && liveGame.stage !== 'SHOWDOWN') cardClass = "bg-zinc-900 border-amber-500/60 ring-2 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]";

                      const isMe = p.id === currentPlayerId;

                      return (
                        <div key={p.id} className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative ${cardClass}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${isMe ? 'bg-amber-500/20 text-amber-400 border border-amber-500/10' : 'bg-zinc-800 text-zinc-400'}`}>
                              Seat {idx + 1} {isMe && "(You)"}
                            </span>
                            <div className="flex items-center gap-1">
                              {isDealer && (
                                <span className="w-5 h-5 rounded-full bg-white text-zinc-950 font-bold text-[9px] flex items-center justify-center border border-zinc-200 shadow-md">D</span>
                              )}
                              {blindLabel && !p.folded && (
                                <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${blindLabel === 'BB' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{blindLabel}</span>
                              )}
                            </div>
                          </div>

                          <div className="mb-2">
                            <h4 className={`text-sm font-bold truncate ${isActing && liveGame.stage !== 'SHOWDOWN' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'}`}>{p.name}</h4>
                            <p className="text-xs text-zinc-500 font-semibold tracking-wide">
                              Stack: <span className="font-mono text-zinc-300 font-extrabold">{Number(p.stack).toLocaleString()}</span>
                            </p>
                          </div>

                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs min-h-[24px]">
                            {p.folded ? (
                              <span className="text-zinc-600 font-semibold uppercase tracking-wider text-[10px]">Folded</span>
                            ) : p.isAllIn ? (
                              <span className="text-rose-400 font-bold uppercase tracking-wider text-[10px] animate-pulse">All-In</span>
                            ) : p.currentBet > 0 ? (
                              <div className="flex items-center gap-1 text-zinc-400 font-medium">
                                <Coins className="w-3 h-3 text-amber-500" />
                                <span>Bet: <span className="font-mono text-zinc-200 font-bold">{p.currentBet.toLocaleString()}</span></span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 italic">No bet</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* History log */}
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Recent History</span>
                    <div className="bg-zinc-950/60 border border-white/5 p-3 rounded-xl font-mono text-[11px] text-zinc-400 h-24 overflow-y-auto space-y-1 scrollbar-thin">
                      {liveGame.history?.slice(-5).map((log, i) => (
                        <div key={i} className="leading-relaxed truncate">
                          <span className="text-zinc-600 mr-2 font-bold">&gt;</span>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

        {/* Spectator Buy-In Form */}
        {!playerTable && !activeDeclaration && (
          <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl max-w-lg mx-auto space-y-4 shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-white">Join the Virtual Table</h3>
              <p className="text-xs text-zinc-500 mt-1">{buyInHelpText}</p>
            </div>
            
            <form onSubmit={handleBuyIn} className="space-y-4">
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
                <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Buy-In Amount</label>
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
                    className="px-4 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={maxAllowedBuyIn <= 0 || isSubmitting}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(245,158,11,0.1)] cursor-pointer disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
              >
                <Coins className="w-4 h-4" />
                <span>{isSubmitting ? 'Processing...' : 'Confirm Buy-In & Seat Request'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Loan Center */}
        {renderLoanCenter()}

        {/* Inline Rebuy Modal */}
        {showInlineRebuyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl relative">
              <button onClick={() => setShowInlineRebuyModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full z-10"><X className="w-5 h-5"/></button>
              
              <div>
                <h3 className="text-lg font-bold text-white">Declare Rebuy</h3>
                <p className="text-xs text-zinc-500 mt-1">Get more chips directly to your stack.</p>
              </div>

              <div className="bg-zinc-950/60 border border-white/5 p-3 rounded-xl text-xs text-zinc-400 font-mono space-y-1">
                <div className="flex justify-between">
                  <span>Available Balance:</span>
                  <span>{availableBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining Case Chips:</span>
                  <span>{remainingCaseChips.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Rebuy Amount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    id="inlineRebuyAmountInput"
                    placeholder={`Max: ${maxAllowedRebuy.toLocaleString()}`}
                    className="bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white w-full focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    onClick={() => {
                      const inp = document.getElementById('inlineRebuyAmountInput');
                      if (inp) inp.value = maxAllowedRebuy.toString();
                    }}
                    className="px-3 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-colors cursor-pointer"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  const val = Number(document.getElementById('inlineRebuyAmountInput')?.value || 0);
                  handleInlineRebuySubmit(val);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-all text-sm font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)] cursor-pointer"
              >
                Confirm Rebuy
              </button>
            </div>
          </div>
        )}

        {renderErrorModal()}
      </div>
    );
  }

  // ── Pre-Game State (If currentPlayerId is set, but no live table is active) ──
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
        <div className="flex justify-between items-center mt-6 border-t border-white/5 pt-6 pb-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Account Balance</h3>
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
            Physical Chips (Not Net Worth)
          </span>
        </div>
        {(() => {
          const isCashedOut = activeDeclaration?.status === 'cashed_out';
          const pendingCashOut = Number(activeDeclaration?.cashOut || 0);
          const pendingTotal = availableBalance + pendingCashOut;

          if (isCashedOut) {
            // Player has declared cash-out — show pending settlement state
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">End of Prev Day</span>
                  <div className="text-xl font-black text-white font-mono mt-1 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-zinc-400" />
                    {baselineBalance.toLocaleString()}
                  </div>
                </div>

                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Banked</span>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {availableBalance.toLocaleString()}
                  </div>
                </div>

                {/* Pending Settlement Card — distinct from bank/wallet */}
                <div className="relative bg-gradient-to-br from-orange-950/40 via-amber-950/30 to-zinc-950/40 p-4 rounded-2xl border border-dashed border-amber-500/40 overflow-hidden">
                  <div className="absolute inset-0 bg-amber-500/5 rounded-2xl pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Hourglass className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span className="text-[10px] text-amber-500/80 uppercase font-bold tracking-wider">Pending Settlement</span>
                    </div>
                    <div className="text-xl font-black text-amber-300 font-mono">
                      {pendingTotal.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-amber-600/70 mt-1 font-mono">
                      {availableBalance.toLocaleString()} bank + {pendingCashOut.toLocaleString()} cashout
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Normal (not yet cashed out) — standard 3-card layout
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">End of Prev Day</span>
                <div className="text-xl font-black text-white font-mono mt-1 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-zinc-400" />
                  {baselineBalance.toLocaleString()}
                </div>
              </div>

              <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Wallet</span>
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
          );
        })()}
      </div>

      {/* Net Worth Progression Sparkline */}
      {renderTrendChart()}

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
                            className="px-4 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed animate-none"
                          >
                            Max
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={maxAllowedBuyIn <= 0 || isSubmitting}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-[0_0_15px_rgba(245,158,11,0.1)] cursor-pointer disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed animate-none"
                      >
                        <Coins className="w-4 h-4" />
                        <span>{isSubmitting ? 'Processing...' : 'Confirm Buy-In & Start Playing'}</span>
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
                            disabled={maxAllowedRebuy <= 0 || isSubmitting}
                            className="px-5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed animate-none"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? 'Processing...' : 'Rebuy'}</span>
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
                            disabled={isSubmitting}
                            className="px-6 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-transparent disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isSubmitting ? 'Processing...' : 'Cash Out'}</span>
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
          {renderLoanCenter()}
        </div>
      </div>
      {renderErrorModal()}
    </div>
  );
}

function ActionControlPanel({
  actingPlayer,
  minRaiseTo,
  totalLivePot,
  handleAction,
  liveGame
}) {
  const [raiseValue, setRaiseValue] = useState(minRaiseTo);
  const [prevMinRaiseTo, setPrevMinRaiseTo] = useState(minRaiseTo);

  if (minRaiseTo !== prevMinRaiseTo) {
    setPrevMinRaiseTo(minRaiseTo);
    setRaiseValue(minRaiseTo);
  }

  const handleAddChip = (amount) => {
    const current = Number(raiseValue || 0);
    const maxVal = Number(actingPlayer.stack || 0) + Number(actingPlayer.currentBet || 0);
    const nextVal = Math.min(current + amount, maxVal);
    setRaiseValue(nextVal);
  };

  return (
    <div className="space-y-4">
      {/* Current Active Player Info */}
      <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Waiting on Player Turn</p>
        <h4 className="text-base font-bold text-amber-400 mt-1">{actingPlayer.name}</h4>
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-xs text-zinc-400">
          <span>Stack: <strong className="font-mono text-zinc-200">{Number(actingPlayer.stack).toLocaleString()}</strong></span>
          <span>Bet: <strong className="font-mono text-zinc-200">{Number(actingPlayer.currentBet).toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Standard Decision Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleAction('FOLD')}
          className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-white/5 text-zinc-300 font-bold py-3 px-2 rounded-xl text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
        >
          Fold
        </button>
        
        <button
          onClick={() => handleAction('CHECK')}
          disabled={Number(actingPlayer.currentBet) < Number(liveGame.highestBet)}
          className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-white/5 text-zinc-300 font-bold py-3 px-2 rounded-xl text-xs sm:text-sm transition-all shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Check
        </button>

        <button
          onClick={() => handleAction('CALL')}
          disabled={Number(actingPlayer.currentBet) >= Number(liveGame.highestBet)}
          className="bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-bold py-3 px-2 rounded-xl text-xs sm:text-sm transition-all shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center"
        >
          <span className="leading-none">Call</span>
          {Number(liveGame.highestBet) > Number(actingPlayer.currentBet) && (
            <span className="text-[9px] font-mono mt-0.5 opacity-80">
              ({(Number(liveGame.highestBet) - Number(actingPlayer.currentBet)).toLocaleString()})
            </span>
          )}
        </button>
      </div>

      {/* Raise Slider and Numeric input */}
      <div className="pt-2 border-t border-white/5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400 font-semibold">Raise to:</span>
          <input
            type="number"
            placeholder={`Min: ${minRaiseTo}`}
            value={raiseValue}
            onChange={(e) => setRaiseValue(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-right text-sm text-zinc-200 font-mono font-semibold w-28 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Place Chips */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>Place Chips:</span>
            <button
              type="button"
              onClick={() => setRaiseValue(minRaiseTo)}
              className="text-amber-500 hover:text-amber-400 transition-colors uppercase text-[9px] font-extrabold"
            >
              Reset to Min
            </button>
          </div>
          <div className="flex items-center justify-between gap-1 bg-zinc-950/40 p-2 rounded-2xl border border-white/5">
            {[
              { value: 10, bg: 'bg-[#f4f4f5] text-zinc-950 border-zinc-300' },
              { value: 50, bg: 'bg-rose-600 text-white border-rose-500' },
              { value: 100, bg: 'bg-blue-600 text-white border-blue-500' },
              { value: 500, bg: 'bg-emerald-600 text-white border-emerald-500' },
              { value: 1000, bg: 'bg-zinc-950 text-amber-400 border-amber-500' }
            ].map(chip => (
              <button
                key={chip.value}
                type="button"
                onClick={() => handleAddChip(chip.value)}
                className={`w-8 h-8 rounded-full border-2 border-dashed font-black text-[9px] flex items-center justify-center shadow-lg active:scale-90 hover:-translate-y-0.5 transition-all cursor-pointer ${chip.bg}`}
              >
                {chip.value}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5 text-[9px] font-bold font-mono">
          <button
            onClick={() => setRaiseValue(minRaiseTo)}
            className="bg-zinc-950/60 border border-white/5 hover:bg-zinc-800 py-1.5 rounded-lg text-zinc-450 transition-colors"
          >
            MIN
          </button>
          <button
            onClick={() => setRaiseValue(Math.max(minRaiseTo, totalLivePot))}
            className="bg-zinc-950/60 border border-white/5 hover:bg-zinc-800 py-1.5 rounded-lg text-zinc-450 transition-colors"
          >
            POT
          </button>
          <button
            onClick={() => setRaiseValue(Math.max(minRaiseTo, totalLivePot * 2))}
            className="bg-zinc-950/60 border border-white/5 hover:bg-zinc-800 py-1.5 rounded-lg text-zinc-450 transition-colors"
          >
            2xPOT
          </button>
          <button
            onClick={() => setRaiseValue(actingPlayer.stack + actingPlayer.currentBet)}
            className="bg-rose-950/30 border border-rose-500/10 hover:bg-rose-900/20 py-1.5 rounded-lg text-rose-450 transition-colors"
          >
            ALLIN
          </button>
        </div>

        <button
          onClick={() => handleAction('RAISE', raiseValue)}
          disabled={!raiseValue || Number(raiseValue) < minRaiseTo || Number(raiseValue) > (actingPlayer.stack + actingPlayer.currentBet)}
          className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-2.5 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Submit Raise
        </button>
      </div>
    </div>
  );
}
