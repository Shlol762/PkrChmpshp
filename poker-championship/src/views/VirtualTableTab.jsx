import { useState, useMemo, useEffect } from 'react';
import { doc, setDoc, deleteDoc, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, safeAppId } from '../firebase';
import {
  Trophy,
  Play,
  Check,
  Coins,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Power,
  Users,
  Eye,
  Info
} from 'lucide-react';
import {
  findNextActivePlayer,
  calculateSuggestedPayouts,
  isBettingRoundComplete,
  startNewHand
} from '../utils/pokerGameEngine';
import { getSystemStateAtDay } from '../utils/pokerEngine';

export default function VirtualTableTab({
  isAuthenticated,
  config,
  liveGame,
  currentDay,
  sessions,
  currentPlayerId,
  setCurrentPlayerId
}) {
  // Setup local states for Seat Claiming
  const [claimPlayerId, setClaimPlayerId] = useState('');
  const [claimPin, setClaimPin] = useState('');
  const [claimError, setClaimError] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);

  // Setup local states
  const [selectedPlayers, setSelectedPlayers] = useState(
    config.players.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );
  const [startingStacks, setStartingStacks] = useState(() => {
    const latestSession = sessions && sessions.length > 0 ? sessions[0] : null;
    const nextDay = currentDay + 1;
    const { totalSalaryPerPlayer: currentSalary } = getSystemStateAtDay(currentDay, config);
    const { totalSalaryPerPlayer: nextSalary } = getSystemStateAtDay(nextDay, config);
    const salaryBump = nextSalary - currentSalary;

    return config.players.reduce((acc, p) => {
      const lastKnownBalance = latestSession?.balances?.[p.id] ?? Number(p.startBalance || 0);
      acc[p.id] = Number(lastKnownBalance) + salaryBump;
      return acc;
    }, {});
  });
  const [sbAmount, setSbAmount] = useState(10);
  const [bbAmount, setBbAmount] = useState(50);
  const [initialDealerId, setInitialDealerId] = useState(config.players[0]?.id || '');
  
  // Game control states
  const [selectedWinners, setSelectedWinners] = useState([]);
  const [winnerPayouts, setWinnerPayouts] = useState({});
  const [showManualPanel, setShowManualPanel] = useState(false);
  const [manualAdjustPlayer, setManualAdjustPlayer] = useState('');
  const [manualAdjustAmount, setManualAdjustAmount] = useState('');
  const [manualAdjustReason, setManualAdjustReason] = useState('Rebuy');

  const gameDocRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', 'main');

  // Derive active players list for setup
  const tablePlayers = useMemo(() => {
    return config.players.filter(p => selectedPlayers[p.id]);
  }, [config.players, selectedPlayers]);

  // Compute live game stats
  const totalLivePot = useMemo(() => {
    if (!liveGame || !liveGame.active) return 0;
    return (liveGame.pot || 0) + (liveGame.players || []).reduce((sum, p) => sum + (p.currentBet || 0), 0);
  }, [liveGame]);

  // Check if betting round is complete (to show "Proceed to Next Street" button)
  const isStreetSettled = useMemo(() => {
    if (!liveGame || !liveGame.active || liveGame.stage === 'SHOWDOWN') return false;
    return isBettingRoundComplete(liveGame.players, liveGame.highestBet);
  }, [liveGame]);

  // Get active acting player
  const actingPlayer = useMemo(() => {
    if (!liveGame || !liveGame.active || liveGame.actingPlayerIndex === undefined || liveGame.actingPlayerIndex === -1) return null;
    return liveGame.players[liveGame.actingPlayerIndex] || null;
  }, [liveGame]);

  // Minimum raise calculator
  const minRaiseTo = useMemo(() => {
    if (!liveGame || !actingPlayer) return 0;
    const highestBet = Number(liveGame.highestBet || 0);
    const prevHighestBet = Number(liveGame.previousHighestBet || 0);
    const bigBlind = Number(liveGame.bigBlind || 100);

    const diff = highestBet - prevHighestBet;
    const raiseDiff = Math.max(bigBlind, diff);
    const theoreticalMin = highestBet + raiseDiff;

    // Stack is what player has left, currentBet is what they already have in front of them
    const maxCanRaiseTo = Number(actingPlayer.stack || 0) + Number(actingPlayer.currentBet || 0);
    return Math.min(theoreticalMin, maxCanRaiseTo);
  }, [liveGame, actingPlayer]);

  // Payout options when winners are selected in Showdown
  const handleWinnerToggle = (playerId) => {
    let nextWinners = [...selectedWinners];
    if (nextWinners.includes(playerId)) {
      nextWinners = nextWinners.filter(id => id !== playerId);
    } else {
      nextWinners.push(playerId);
    }
    setSelectedWinners(nextWinners);

    if (liveGame) {
      const suggested = calculateSuggestedPayouts(liveGame.players, nextWinners);
      setWinnerPayouts(suggested);
    }
  };

  const handlePayoutChange = (playerId, val) => {
    setWinnerPayouts(prev => ({ ...prev, [playerId]: val === '' ? '' : Number(val) }));
  };

  // State update runner
  const updateDbState = async (nextState) => {
    const isMyTurn = liveGame && liveGame.active && liveGame.actingPlayerIndex !== -1 && 
      (liveGame.players[liveGame.actingPlayerIndex]?.id === currentPlayerId);

    if (!isAuthenticated && !isMyTurn) return;
    try {
      await setDoc(gameDocRef, {
        ...nextState,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating live game state:", err);
    }
  };

  // Submit a turn action to the Drop-Box commands list (for non-host players)
  const submitPlayerAction = async (actionType, payload = null) => {
    if (!currentPlayerId) return;
    const pin = localStorage.getItem('poker_player_pin') || '';
    try {
      const commandsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands');
      await addDoc(commandsRef, {
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

  // Click handler that switches between direct Host state updates and Player command submissions
  const handleActionClick = async (actionType, payload = null) => {
    if (isAuthenticated) {
      await handleAction(actionType, payload);
    } else {
      await submitPlayerAction(actionType, payload);
    }
  };

  // Host processor listener: processes commands from the player queue
  useEffect(() => {
    if (!isAuthenticated || !liveGame || !liveGame.active) return;

    const commandsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands');
    const unsub = onSnapshot(commandsRef, async (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Process in timestamp order
      docs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      for (const cmd of docs) {
        if (actingPlayer && cmd.playerId === actingPlayer.id) {
          // Process the action using host authentication
          await handleAction(cmd.action, cmd.payload);
        }
        // Delete the command document so it is only processed once
        try {
          await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGameCommands', cmd.id));
        } catch (err) {
          console.error("Error deleting command:", err);
        }
      }
    });

    return () => unsub();
  }, [isAuthenticated, liveGame, actingPlayer]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  
  const handleStartGame = async () => {
    const activeRoster = config.players
      .filter(p => selectedPlayers[p.id])
      .map(p => ({
        id: p.id,
        name: p.name,
        stack: Number(startingStacks[p.id] || 0),
        currentBet: 0,
        totalHandInvestment: 0,
        folded: false,
        isAllIn: false,
        outOfChips: false,
        hasActed: false
      }));

    if (activeRoster.length < 2) {
      alert("You need at least 2 players to start a poker game.");
      return;
    }

    const dealerIdx = activeRoster.findIndex(p => p.id === initialDealerId);
    const finalDealerIdx = dealerIdx !== -1 ? dealerIdx : 0;

    const initialState = {
      active: true,
      handNumber: 0,
      stage: 'SETUP',
      dealerIndex: finalDealerIdx,
      smallBlind: Number(sbAmount),
      bigBlind: Number(bbAmount),
      pot: 0,
      highestBet: 0,
      previousHighestBet: 0,
      actingPlayerIndex: -1,
      players: activeRoster,
      history: ["Live game session started."]
    };

    // Auto post blinds and trigger Hand #1
    const firstHandState = startNewHand(initialState);
    await updateDbState(firstHandState);
  };

  const handleAction = async (actionType, payload = null) => {
    const isMyTurn = currentPlayerId && actingPlayer && actingPlayer.id === currentPlayerId;
    if (!liveGame || !actingPlayer || (!isAuthenticated && !isMyTurn)) return;

    const updatedPlayers = liveGame.players.map(p => ({ ...p }));
    const player = updatedPlayers[liveGame.actingPlayerIndex];
    let nextHighest = Number(liveGame.highestBet);
    let nextPrevHighest = Number(liveGame.previousHighestBet);
    let logMsg = "";

    player.hasActed = true;

    if (actionType === 'FOLD') {
      player.folded = true;
      logMsg = `${player.name} folded.`;
    } 
    else if (actionType === 'CHECK') {
      logMsg = `${player.name} checked.`;
    } 
    else if (actionType === 'CALL') {
      const callAmount = nextHighest - player.currentBet;
      if (player.stack <= callAmount) {
        // All-in Call
        const actualCall = player.stack;
        player.currentBet += actualCall;
        player.totalHandInvestment += actualCall;
        player.stack = 0;
        player.isAllIn = true;
        logMsg = `${player.name} called all-in (${actualCall}).`;
      } else {
        player.stack -= callAmount;
        player.currentBet += callAmount;
        player.totalHandInvestment += callAmount;
        logMsg = `${player.name} called (${callAmount}).`;
      }
    } 
    else if (actionType === 'RAISE') {
      const targetBet = Number(payload);
      const addedAmount = targetBet - player.currentBet;

      if (player.stack <= addedAmount) {
        // All-in raise/bet
        const actualRaise = player.stack;
        player.currentBet += actualRaise;
        player.totalHandInvestment += actualRaise;
        player.stack = 0;
        player.isAllIn = true;
        nextPrevHighest = nextHighest;
        nextHighest = player.currentBet;
        logMsg = `${player.name} raised all-in to ${player.currentBet}.`;
      } else {
        player.stack -= addedAmount;
        player.currentBet += addedAmount;
        player.totalHandInvestment += addedAmount;
        nextPrevHighest = nextHighest;
        nextHighest = targetBet;
        logMsg = `${player.name} raised to ${targetBet}.`;
      }

      // Re-enable action for everyone else who is active (not folded/all-in)
      updatedPlayers.forEach((p, idx) => {
        if (idx !== liveGame.actingPlayerIndex) {
          p.hasActed = false;
        }
      });
    }

    // Check folded count
    const unfoldedPlayers = updatedPlayers.filter(p => !p.folded);
    if (unfoldedPlayers.length === 1) {
      // Award pot to last player standing
      const winner = unfoldedPlayers[0];
      const winPot = totalLivePot;
      winner.stack += winPot;

      const finishMsg = `${winner.name} won the pot of ${winPot.toLocaleString()} chips because everyone else folded.`;
      
      const nextHandState = startNewHand({
        ...liveGame,
        players: updatedPlayers,
        history: [...liveGame.history, logMsg, finishMsg]
      });

      await updateDbState(nextHandState);
      return;
    }

    // Find next player
    let nextPlayerIdx = findNextActivePlayer((liveGame.actingPlayerIndex + 1) % updatedPlayers.length, updatedPlayers);

    // If next player index is -1, it means everyone else is folded or all-in
    // Or, if betting round is complete
    const isRoundComplete = isBettingRoundComplete(updatedPlayers, nextHighest);

    if (isRoundComplete) {
      // Round is settled, wait for dealer to advance street
      await updateDbState({
        ...liveGame,
        players: updatedPlayers,
        highestBet: nextHighest,
        previousHighestBet: nextPrevHighest,
        actingPlayerIndex: -1, // Wait for action
        history: [...liveGame.history, logMsg]
      });
    } else {
      await updateDbState({
        ...liveGame,
        players: updatedPlayers,
        highestBet: nextHighest,
        previousHighestBet: nextPrevHighest,
        actingPlayerIndex: nextPlayerIdx,
        history: [...liveGame.history, logMsg]
      });
    }
  };

  const handleProceedNextStreet = async () => {
    if (!liveGame || !isAuthenticated) return;

    // Collect bets to pot
    const streetBets = liveGame.players.reduce((sum, p) => sum + (p.currentBet || 0), 0);
    const newPot = (liveGame.pot || 0) + streetBets;

    const updatedPlayers = liveGame.players.map(p => ({
      ...p,
      currentBet: 0,
      hasActed: false
    }));

    // Next Stage
    let nextStage = 'FLOP';
    if (liveGame.stage === 'PRE_FLOP') nextStage = 'FLOP';
    else if (liveGame.stage === 'FLOP') nextStage = 'TURN';
    else if (liveGame.stage === 'TURN') nextStage = 'RIVER';
    else if (liveGame.stage === 'RIVER') nextStage = 'SHOWDOWN';

    // Find acting player (first active to left of dealer button)
    let nextActingIdx = -1;
    if (nextStage !== 'SHOWDOWN') {
      nextActingIdx = findNextActivePlayer((liveGame.dealerIndex + 1) % updatedPlayers.length, updatedPlayers);
      
      // If there are no active players with chips (everyone else is all-in), go straight to Showdown!
      const activeChipsCount = updatedPlayers.filter(p => !p.folded && !p.isAllIn && !p.outOfChips).length;
      if (activeChipsCount <= 1) {
        nextStage = 'SHOWDOWN';
        nextActingIdx = -1;
      }
    }

    const logMsg = `Proceeded to ${nextStage}. Collected ${streetBets.toLocaleString()} bets. Total Pot: ${newPot.toLocaleString()}.`;

    await updateDbState({
      ...liveGame,
      stage: nextStage,
      pot: newPot,
      highestBet: 0,
      previousHighestBet: 0,
      actingPlayerIndex: nextActingIdx,
      players: updatedPlayers,
      history: [...liveGame.history, logMsg]
    });

    setSelectedWinners([]);
    setWinnerPayouts({});
  };

  const handleAwardShowdown = async () => {
    if (!liveGame || !isAuthenticated) return;

    const totalPayout = Object.values(winnerPayouts).reduce((sum, v) => sum + Number(v || 0), 0);
    if (totalPayout !== totalLivePot) {
      alert(`Invalid payouts: Sum of payouts (${totalPayout.toLocaleString()}) must equal the total pot (${totalLivePot.toLocaleString()}).`);
      return;
    }

    const updatedPlayers = liveGame.players.map(p => {
      const payout = Number(winnerPayouts[p.id] || 0);
      return {
        ...p,
        stack: p.stack + payout
      };
    });

    let payoutLogs = [];
    Object.entries(winnerPayouts).forEach(([id, amt]) => {
      if (amt > 0) {
        const name = liveGame.players.find(p => p.id === id)?.name || id;
        payoutLogs.push(`${name} won ${amt.toLocaleString()} chips`);
      }
    });

    const nextHandState = startNewHand({
      ...liveGame,
      players: updatedPlayers,
      history: [...liveGame.history, `Showdown complete. ` + payoutLogs.join(', ') + '.']
    });

    await updateDbState(nextHandState);
    setSelectedWinners([]);
    setWinnerPayouts({});
  };

  const handleManualAdjustment = async () => {
    if (!liveGame || !manualAdjustPlayer || !isAuthenticated) return;
    const amount = Number(manualAdjustAmount);
    if (isNaN(amount) || amount === 0) return;

    const updatedPlayers = liveGame.players.map(p => {
      if (p.id === manualAdjustPlayer) {
        const nextStack = Math.max(0, p.stack + amount);
        return {
          ...p,
          stack: nextStack,
          outOfChips: nextStack <= 0
        };
      }
      return p;
    });

    const name = liveGame.players.find(p => p.id === manualAdjustPlayer)?.name || manualAdjustPlayer;
    const sign = amount > 0 ? '+' : '';
    const logMsg = `[Manual Override] ${name} stack adjusted by ${sign}${amount.toLocaleString()} (${manualAdjustReason}).`;

    await updateDbState({
      ...liveGame,
      players: updatedPlayers,
      history: [...liveGame.history, logMsg]
    });

    setManualAdjustAmount('');
    setShowManualPanel(false);
  };

  const handleResetGame = async () => {
    if (!window.confirm("Are you sure you want to reset the current Live Game? All current stacks and hand histories will be deleted.")) return;
    try {
      await deleteDoc(gameDocRef);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveToLedger = async () => {
    if (!liveGame || !isAuthenticated) return;
    if (!window.confirm("End this Live Game and save the final player stacks as a new Day session in the Daily Ledger?")) return;

    try {
      // 1. Calculate salary bump for this next day
      const nextDay = currentDay + 1;
      const { totalSalaryPerPlayer: currentSalary } = getSystemStateAtDay(currentDay, config);
      const { totalSalaryPerPlayer: nextSalary } = getSystemStateAtDay(nextDay, config);
      const salaryBump = nextSalary - currentSalary;

      const latestSession = sessions && sessions.length > 0 ? sessions[0] : null;

      // 2. Map live game stacks back to ledger schema
      const sessionBalances = {};
      
      // All roster players
      config.players.forEach(p => {
        // Find if they were in the live game
        const liveP = liveGame.players.find(lp => lp.id === p.id);
        if (liveP) {
          // Refund any investments currently in play for this player (pots or bets)
          const refundedStack = Number(liveP.stack || 0) + Number(liveP.totalHandInvestment || 0);
          sessionBalances[p.id] = refundedStack;
        } else {
          // If not in game, carry forward their balance from latest session (and add salary bump if payday)
          const lastKnownBalance = latestSession?.balances?.[p.id] ?? Number(p.startBalance);
          sessionBalances[p.id] = lastKnownBalance + salaryBump;
        }
      });

      // Save to sessions
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions'), {
        dayNumber: Number(nextDay),
        balances: sessionBalances,
        recordedAt: new Date().toISOString(),
        recordedBy: 'VirtualTableCompanion',
      });

      // Clear the live game state
      await deleteDoc(gameDocRef);
      alert(`Game ended successfully! Final stacks saved as Session Day ${nextDay}.`);
    } catch (err) {
      console.error("Error saving live game to ledger:", err);
      alert("Failed to save session to ledger.");
    }
  };

  // ── Rendering Setup Screen ──────────────────────────────────────────────────
  if (!liveGame || !liveGame.active) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Coins className="h-6 w-6 text-amber-500" />
              Virtual Table Manager
            </h2>
            <p className="text-sm text-zinc-500 mt-1">Host a turn-by-turn digital poker game with virtual chips.</p>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="text-center py-16 bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
            <AlertTriangle className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300">No Active Live Game</h3>
            <p className="text-zinc-500 text-sm mt-2 max-w-md mx-auto">
              There is currently no live game session running. To host a game, unlock Admin Controls in the top bar using the league PIN.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl space-y-6">
            <h3 className="text-md font-bold text-zinc-200 border-b border-white/5 pb-3">New Session Setup</h3>

            {/* Roster Select */}
            <div>
              <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5" />
                Select Players at the Table
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {config.players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlayers(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${
                      selectedPlayers[p.id]
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-zinc-950/40 border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${selectedPlayers[p.id] ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-900 text-zinc-600'}`}>
                      {p.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Starting Stack adjustments */}
            {tablePlayers.length > 0 && (
              <div>
                <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-3 block">Starting Chip Stacks</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950/40 p-4 rounded-2xl border border-white/5 max-h-60 overflow-y-auto">
                  {tablePlayers.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-4 py-1.5">
                      <span className="text-sm font-medium text-zinc-300">{p.name}</span>
                      <input
                        type="number"
                        value={startingStacks[p.id] ?? 0}
                        onChange={(e) => setStartingStacks(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                        className="bg-zinc-900 border border-white/10 rounded-lg py-1.5 px-3 text-right text-sm text-zinc-200 w-24 font-mono font-semibold focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blinds and Button */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Small Blind</label>
                <input
                  type="number"
                  value={sbAmount}
                  onChange={(e) => setSbAmount(Number(e.target.value))}
                  className="bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 px-4 text-zinc-200 font-mono font-semibold w-full focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Big Blind</label>
                <input
                  type="number"
                  value={bbAmount}
                  onChange={(e) => setBbAmount(Number(e.target.value))}
                  className="bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 px-4 text-zinc-200 font-mono font-semibold w-full focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Dealer Button (Pos 1)</label>
                <select
                  value={initialDealerId}
                  onChange={(e) => setInitialDealerId(e.target.value)}
                  className="bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 px-4 text-zinc-200 text-sm font-semibold w-full focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>Select Player</option>
                  {tablePlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleStartGame}
              disabled={tablePlayers.length < 2}
              className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-3.5 px-6 rounded-2xl transition-all shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              <Play className="h-5 w-5 fill-amber-950" />
              Start Live Game
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Rendering Claim Seat Screen ─────────────────────────────────────────────
  if (!isAuthenticated && !currentPlayerId && !isSpectator) {
    const liveGamePlayerIds = liveGame.players.map(p => p.id);
    const selectablePlayers = config.players.filter(p => liveGamePlayerIds.includes(p.id));

    return (
      <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-500 py-8">
        <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl">
          <div className="text-center">
            <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white tracking-tight">Claim Your Seat</h2>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Select your name and enter your player PIN to control your actions on this phone.
            </p>
          </div>

          {claimError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
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
                className="bg-zinc-950 border border-white/10 rounded-xl py-2.5 px-4 text-zinc-200 text-sm font-semibold w-full focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Select your name...</option>
                {selectablePlayers.map(p => (
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
                  // Write a claim verification note to playerClaims
                  const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', claimPlayerId);
                  await setDoc(claimRef, {
                    playerId: claimPlayerId,
                    pin: claimPin,
                    timestamp: new Date().toISOString()
                  });
                  // If write succeeds, PIN is valid per database rules!
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

            <div className="text-center pt-2">
              <button
                onClick={() => setIsSpectator(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 font-medium transition-colors underline underline-offset-4"
              >
                Just view the table (Spectator Mode)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Rendering Active Game Screen ────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Player seat identification / Spectator warning badge */}
      {!isAuthenticated && currentPlayerId && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 px-4 rounded-2xl flex items-center justify-between gap-2.5 text-sm font-semibold">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Playing as: <strong className="text-white">{config.players.find(p => p.id === currentPlayerId)?.name || currentPlayerId}</strong></span>
          </div>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to vacate this seat?")) {
                setCurrentPlayerId(null);
                localStorage.removeItem('poker_player_id');
                localStorage.removeItem('poker_player_pin');
                setClaimPlayerId('');
                setClaimPin('');
              }
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold"
          >
            Leave Seat
          </button>
        </div>
      )}

      {!isAuthenticated && !currentPlayerId && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 py-3 px-4 rounded-2xl flex items-center justify-between gap-2.5 text-sm font-semibold">
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5" />
            <span>Spectator Mode (Read Only)</span>
          </div>
          <button
            onClick={() => setIsSpectator(false)}
            className="text-xs text-amber-950 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer"
          >
            Claim a Seat
          </button>
        </div>
      )}

      {/* Top Banner stats */}
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
        
        {/* LEFT COLUMN: Circular / Grid Table Stacks (8 columns width) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6 relative min-h-[360px] flex flex-col justify-between">
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <Trophy className="w-60 h-60 text-white" />
            </div>

            <div className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-4 pb-2 border-b border-white/5 flex justify-between items-center z-10">
              <span>Table Seats</span>
              <span className="font-mono text-zinc-600">Active Players: {liveGame.players.filter(p => !p.outOfChips && !p.folded).length}</span>
            </div>

            {/* Grid Layout of Players */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10">
              {liveGame.players.map((p, idx) => {
                const isDealer = idx === liveGame.dealerIndex;
                const isActing = idx === liveGame.actingPlayerIndex;
                
                // Determine blind status
                let blindLabel = "";
                const activeCount = liveGame.players.filter(lp => !lp.outOfChips).length;
                
                // Construct a quick index-map of active players for SB/BB check
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

                return (
                  <div key={p.id} className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative ${cardClass}`}>
                    
                    {/* Badge header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400">
                        Seat {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        {isDealer && (
                          <span className="w-5 h-5 rounded-full bg-white text-zinc-950 font-bold text-[9px] flex items-center justify-center border border-zinc-200 shadow-md" title="Dealer Button">
                            D
                          </span>
                        )}
                        {blindLabel && !p.folded && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${blindLabel === 'BB' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                            {blindLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <h4 className={`text-base font-bold truncate ${isActing && liveGame.stage !== 'SHOWDOWN' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'}`}>
                        {p.name}
                      </h4>
                      <p className="text-xs text-zinc-500 font-semibold tracking-wide">
                        Stack: <span className="font-mono text-zinc-300 font-extrabold">{Number(p.stack).toLocaleString()}</span>
                      </p>
                    </div>

                    {/* Bet or status display */}
                    <div className="mt-2 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs min-h-[30px]">
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

            {/* Log / Recent History in card footer */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Recent History</span>
              <div className="bg-zinc-950/60 border border-white/5 p-3.5 rounded-xl font-mono text-xs text-zinc-400 h-28 overflow-y-auto space-y-1 scrollbar-thin">
                {liveGame.history?.slice(-8).map((log, i) => (
                  <div key={i} className="leading-relaxed truncate">
                    <span className="text-zinc-600 mr-2 font-bold">&gt;</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Actions & Control Panel (4 columns width) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Active Action Panel */}
          {liveGame.stage !== 'SHOWDOWN' && (
            isAuthenticated ? (
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4">
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5">
                  Host Action Control
                </h3>

                {actingPlayer ? (
                  <ActionControlPanel
                    key={actingPlayer.id}
                    actingPlayer={actingPlayer}
                    minRaiseTo={minRaiseTo}
                    totalLivePot={totalLivePot}
                    handleAction={handleActionClick}
                    liveGame={liveGame}
                  />
                ) : isStreetSettled ? (
                  <div className="space-y-4 py-4 text-center">
                    <p className="text-sm text-zinc-400 font-medium">Betting round settled!</p>
                    <button
                      onClick={handleProceedNextStreet}
                      className="w-full bg-blue-500 hover:bg-blue-400 text-blue-950 font-bold py-3.5 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 cursor-pointer text-sm"
                    >
                      Proceed to {liveGame.stage === 'PRE_FLOP' ? 'Flop' : liveGame.stage === 'FLOP' ? 'Turn' : liveGame.stage === 'TURN' ? 'River' : 'Showdown'}
                    </button>
                  </div>
                ) : (
                  <div className="py-6 text-center text-zinc-500 italic text-sm">
                    Waiting on players...
                  </div>
                )}
              </div>
            ) : (
              // Player Turn Control
              currentPlayerId && actingPlayer && actingPlayer.id === currentPlayerId ? (
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4">
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5">
                    Your Turn to Act
                  </h3>
                  <ActionControlPanel
                    key={actingPlayer.id}
                    actingPlayer={actingPlayer}
                    minRaiseTo={minRaiseTo}
                    totalLivePot={totalLivePot}
                    handleAction={handleActionClick}
                    liveGame={liveGame}
                  />
                </div>
              ) : (
                // Player waiting turn indicator
                <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 text-center py-6 text-zinc-500 italic text-sm">
                  {actingPlayer ? `Waiting for ${actingPlayer.name} to act...` : isStreetSettled ? "Waiting for Host to advance street..." : "Waiting on players..."}
                </div>
              )
            )
          )}

          {/* Showdown Status for Players */}
          {!isAuthenticated && liveGame.stage === 'SHOWDOWN' && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 text-center py-6 text-zinc-500 italic text-sm">
              Showdown in progress. Waiting for host to award the pot...
            </div>
          )}

          {/* Showdown Payout Awarding Panel */}
          {isAuthenticated && liveGame.stage === 'SHOWDOWN' && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Showdown Winner Payouts
              </h3>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Select Winner(s)</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {liveGame.players.filter(p => !p.folded).map(p => {
                    const isChecked = selectedWinners.includes(p.id);
                    // Compute max eligible amount this player contributed/can win
                    const maxEligible = liveGame.players.reduce((sum, lp) => sum + Math.min(Number(p.totalHandInvestment || 0), Number(lp.totalHandInvestment || 0)), 0);

                    return (
                      <button
                        key={p.id}
                        onClick={() => handleWinnerToggle(p.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-amber-500 border-amber-500 text-amber-950' : 'border-zinc-700'}`}>
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span>{p.name}</span>
                        </div>
                        {p.isAllIn && (
                          <span className="text-[9px] text-zinc-500 font-mono" title="Capped Pot Limit">
                            Cap: {maxEligible.toLocaleString()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedWinners.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
                    <span>Distribute Pot:</span>
                    <span className="font-mono text-zinc-200 font-bold">{totalLivePot.toLocaleString()} chips</span>
                  </div>

                  <div className="space-y-2 bg-zinc-950/30 p-3.5 rounded-2xl border border-white/5 max-h-48 overflow-y-auto">
                    {selectedWinners.map(winnerId => {
                      const name = liveGame.players.find(p => p.id === winnerId)?.name || winnerId;
                      return (
                        <div key={winnerId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-300 font-medium">{name}</span>
                          <input
                            type="number"
                            value={winnerPayouts[winnerId] ?? 0}
                            onChange={(e) => handlePayoutChange(winnerId, e.target.value)}
                            className="bg-zinc-900 border border-white/10 rounded-xl py-1 px-3 text-right text-sm text-zinc-200 font-mono font-semibold w-24 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Warning if sums mismatch */}
                  {Object.values(winnerPayouts).reduce((sum, v) => sum + Number(v || 0), 0) !== totalLivePot && (
                    <div className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Payout sum ({Object.values(winnerPayouts).reduce((sum, v) => sum + Number(v || 0), 0).toLocaleString()}) must match pot!</span>
                    </div>
                  )}

                  <button
                    onClick={handleAwardShowdown}
                    disabled={Object.values(winnerPayouts).reduce((sum, v) => sum + Number(v || 0), 0) !== totalLivePot}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Confirm & Start Next Hand
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Admin Override Settings Card */}
          {isAuthenticated && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-3">
              <button
                onClick={() => setShowManualPanel(!showManualPanel)}
                className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest cursor-pointer hover:text-zinc-300"
              >
                <span>Manual Chip Adjustments</span>
                {showManualPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showManualPanel && (
                <div className="space-y-3 pt-3 border-t border-white/5 animate-in fade-in duration-300">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Player</label>
                    <select
                      value={manualAdjustPlayer}
                      onChange={(e) => setManualAdjustPlayer(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-300 text-xs font-semibold w-full focus:outline-none"
                    >
                      <option value="">Select Player</option>
                      {liveGame.players.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.stack.toLocaleString()})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Add/Sub Chips</label>
                      <input
                        type="number"
                        placeholder="e.g. 5000 or -200"
                        value={manualAdjustAmount}
                        onChange={(e) => setManualAdjustAmount(e.target.value)}
                        className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-200 font-mono text-xs w-full focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Reason</label>
                      <select
                        value={manualAdjustReason}
                        onChange={(e) => setManualAdjustReason(e.target.value)}
                        className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-300 text-xs w-full focus:outline-none"
                      >
                        <option value="Rebuy">Rebuy</option>
                        <option value="Chips Loan">Chips Loan</option>
                        <option value="Pot Split Correction">Split Correction</option>
                        <option value="Other Adjustment">Other Adjust</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleManualAdjustment}
                    disabled={!manualAdjustPlayer || !manualAdjustAmount}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-30"
                  >
                    Apply Adjustment
                  </button>
                </div>
              )}
            </div>
          )}

          {/* End Session button group */}
          {isAuthenticated && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-2">
              <button
                onClick={handleSaveToLedger}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-3 rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Power className="w-4 h-4" />
                End & Save Game
              </button>
              
              <button
                onClick={handleResetGame}
                className="w-full bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-semibold py-2.5 rounded-2xl text-xs transition-all cursor-pointer"
              >
                Reset / Delete Live Game
              </button>
            </div>
          )}

          {/* View Only info card */}
          {!isAuthenticated && (
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 flex gap-3 text-xs text-zinc-500 leading-relaxed">
              <Info className="w-5 h-5 text-zinc-600 shrink-0" />
              <div>
                <p className="font-bold text-zinc-400">Live Viewer Active</p>
                <p className="mt-1">
                  Keep this page open on your phone during the game to monitor active blinds, pot totals, seat orders, and your current chip count.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

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
        <h4 className="text-lg font-bold text-amber-400 mt-1">{actingPlayer.name}</h4>
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5 text-xs text-zinc-400">
          <span>Stack: <strong className="font-mono text-zinc-200">{Number(actingPlayer.stack).toLocaleString()}</strong></span>
          <span>Bet: <strong className="font-mono text-zinc-200">{Number(actingPlayer.currentBet).toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Standard Decision Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleAction('FOLD')}
          className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-white/5 text-zinc-300 font-bold py-3 px-2 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
        >
          Fold
        </button>
        
        <button
          onClick={() => handleAction('CHECK')}
          disabled={Number(actingPlayer.currentBet) < Number(liveGame.highestBet)}
          className="bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-white/5 text-zinc-300 font-bold py-3 px-2 rounded-xl text-sm transition-all shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Check
        </button>

        <button
          onClick={() => handleAction('CALL')}
          disabled={Number(actingPlayer.currentBet) >= Number(liveGame.highestBet)}
          className="bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-bold py-3 px-2 rounded-xl text-sm transition-all shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center"
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
            className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-right text-sm text-zinc-200 font-mono font-semibold w-32 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Place Chips (Denominations: 10, 50, 100, 500, 1000) */}
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
                className={`w-9 h-9 rounded-full border-2 border-dashed font-black text-[10px] flex items-center justify-center shadow-lg active:scale-90 hover:-translate-y-0.5 transition-all cursor-pointer ${chip.bg}`}
              >
                {chip.value}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold font-mono">
          <button
            onClick={() => setRaiseValue(minRaiseTo)}
            className="bg-zinc-950/60 border border-white/5 hover:bg-zinc-800 py-1.5 rounded-lg text-zinc-400 transition-colors"
          >
            MIN
          </button>
          <button
            onClick={() => setRaiseValue(Math.max(minRaiseTo, totalLivePot))}
            className="bg-zinc-950/60 border border-white/5 hover:bg-zinc-800 py-1.5 rounded-lg text-zinc-400 transition-colors"
          >
            POT
          </button>
          <button
            onClick={() => setRaiseValue(Math.max(minRaiseTo, totalLivePot * 2))}
            className="bg-zinc-950/60 border border-white/5 hover:bg-zinc-800 py-1.5 rounded-lg text-zinc-400 transition-colors"
          >
            2xPOT
          </button>
          <button
            onClick={() => setRaiseValue(actingPlayer.stack + actingPlayer.currentBet)}
            className="bg-rose-950/30 border border-rose-500/10 hover:bg-rose-900/20 py-1.5 rounded-lg text-rose-400 transition-colors"
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
