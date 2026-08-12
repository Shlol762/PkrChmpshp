import { useState, useMemo } from 'react';
import { doc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';
import {
  findNextActivePlayer,
  calculateSuggestedPayouts,
  isBettingRoundComplete,
  startNewHand,
  removePlayers,
} from '../../../utils/pokerGameEngine';
import { dealCommunityCards } from '../../../utils/cardEngine';
import { recordRealtimeCashOut } from '../../../utils/ledgerEngine';
import { evaluateShowdown } from '../../../utils/handEvaluator';

const MAX_HISTORY = 5;

function makeSnapshot(game) {
  // eslint-disable-next-line no-unused-vars
  const { stateHistory: _omit, ...rest } = game;
  return rest;
}

export function useGameEngine({
  isAuthenticated,
  config,
  liveGames,
  sessions,
  playerDeclarations,
  currentPlayerId,
  activeTableId,
  setActiveTableId,
}) {
  // ── Setup state ───────────────────────────────────────────────────────────
  const [selectedPlayers, setSelectedPlayers] = useState(
    () => config.players.reduce((acc, p) => ({ ...acc, [p.id]: true }), {})
  );

  const [startingStacks, setStartingStacks] = useState(() => {
    const latestSession = sessions?.length > 0 ? sessions[0] : null;
    const latestCompleted = sessions?.find(s => s.status !== 'active') ?? null;
    return config.players.reduce((acc, p) => {
      if (latestSession?.status === 'active') {
        const dec = playerDeclarations?.[p.id];
        if (dec?.status === 'active') {
          acc[p.id] = Number(dec.buyIn || 0) + Number(dec.rebuys || 0);
        } else {
          const val = latestCompleted?.balances?.[p.id];
          acc[p.id] = typeof val === 'object' && val !== null
            ? Number(val.bank || 0) + Number(val.wallet || 0)
            : Number(val ?? p.startBalance ?? 0);
        }
      } else {
        const val = latestSession?.balances?.[p.id];
        acc[p.id] = typeof val === 'object' && val !== null
          ? Number(val.bank || 0) + Number(val.wallet || 0)
          : Number(val ?? (p.startBalance || 0));
      }
      return acc;
    }, {});
  });

  const [sbAmount, setSbAmount] = useState(10);
  const [bbAmount, setBbAmount] = useState(50);
  const [initialDealerId, setInitialDealerId] = useState(config.players[0]?.id || '');

  // ── Showdown state ────────────────────────────────────────────────────────
  const [selectedWinners, setSelectedWinners] = useState([]);
  const [winnerPayouts, setWinnerPayouts] = useState({});

  // ── Host override state ───────────────────────────────────────────────────
  const [repositionMode, setRepositionMode] = useState(null);
  const [editingStack, setEditingStack] = useState(null);

  // ── Manual adjustment state ───────────────────────────────────────────────
  const [showManualPanel, setShowManualPanel] = useState(false);
  const [manualAdjustPlayer, setManualAdjustPlayer] = useState('');
  const [manualAdjustAmount, setManualAdjustAmount] = useState('');
  const [manualAdjustReason, setManualAdjustReason] = useState('Rebuy');

  // ── Table management form state ───────────────────────────────────────────
  const [addPlayerStacks, setAddPlayerStacks] = useState({});

  // ── Undo counter (mirrors stateHistory array length) ─────────────────────
  const [undoCount, setUndoCount] = useState(0);

  // ── Derived values ────────────────────────────────────────────────────────
  const liveGame = liveGames?.[activeTableId];

  const gameDocRef = useMemo(
    () => doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', activeTableId),
    [activeTableId]
  );

  const tablePlayers = useMemo(
    () => config.players.filter(p => selectedPlayers[p.id]),
    [config.players, selectedPlayers]
  );

  const totalLivePot = useMemo(() => {
    if (!liveGame?.active) return 0;
    return (liveGame.pot || 0) + (liveGame.players || []).reduce((s, p) => s + (p.currentBet || 0), 0);
  }, [liveGame]);

  const isStreetSettled = useMemo(() => {
    if (!liveGame?.active || liveGame.stage === 'SHOWDOWN') return false;
    return isBettingRoundComplete(liveGame.players, liveGame.highestBet);
  }, [liveGame]);

  const actingPlayer = useMemo(() => {
    if (!liveGame?.active || liveGame.actingPlayerIndex === undefined || liveGame.actingPlayerIndex === -1) return null;
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

  // ── State persistence (transaction-safe) ─────────────────────────────────

  const updateDbState = async (nextStateOrUpdater, targetTableId = activeTableId) => {
    if (!isAuthenticated) return;
    try {
      const targetRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', targetTableId);
      const current = liveGames?.[targetTableId] || {};
      const computedNextState = typeof nextStateOrUpdater === 'function'
        ? nextStateOrUpdater(current)
        : { ...current, ...nextStateOrUpdater };

      const { _newHoleCards, ...cleanState } = computedNextState;

      if (_newHoleCards) {
        const holeCardsRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'holeCards', targetTableId);
        await setDoc(holeCardsRef, {
          ..._newHoleCards,
          _handNumber: cleanState.handNumber,
          _updatedAt: new Date().toISOString(),
        });
      }

      const prevSnapshot = current?.active ? makeSnapshot(current) : null;
      const currentHistory = current?.stateHistory || [];
      const newHistory = prevSnapshot
        ? [...currentHistory, prevSnapshot].slice(-MAX_HISTORY)
        : currentHistory;

      await setDoc(targetRef, {
        ...cleanState,
        stateHistory: newHistory,
        lastUpdated: new Date().toISOString(),
      }, { merge: true });
      setUndoCount(c => Math.min(c + 1, MAX_HISTORY));
    } catch (err) {
      console.error('Error updating live game state:', err);
    }
  };

  // ── Showdown helpers ──────────────────────────────────────────────────────

  const handleWinnerToggle = (playerId) => {
    const nextWinners = selectedWinners.includes(playerId)
      ? selectedWinners.filter(id => id !== playerId)
      : [...selectedWinners, playerId];
    setSelectedWinners(nextWinners);
    if (liveGame) {
      setWinnerPayouts(calculateSuggestedPayouts(liveGame.players, nextWinners));
    }
  };

  const handlePayoutChange = (playerId, val) => {
    setWinnerPayouts(prev => ({ ...prev, [playerId]: val === '' ? '' : Number(val) }));
  };

  // ── Undo / Skip / Reposition ──────────────────────────────────────────────

  const handleUndo = async () => {
    if (!liveGame || !isAuthenticated) return;
    const history = liveGame.stateHistory || [];
    if (history.length === 0) { alert('No previous state to undo to.'); return; }
    const prevState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    try {
      const targetRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', activeTableId);
      await setDoc(targetRef, {
        ...prevState,
        stateHistory: newHistory,
        lastUpdated: new Date().toISOString(),
      });
      setUndoCount(c => Math.max(c - 1, 0));
    } catch (err) {
      console.error('Undo error:', err);
    }
  };

  const handleSkipTurn = async () => {
    if (!liveGame || !isAuthenticated || liveGame.actingPlayerIndex === -1) return;
    const next = findNextActivePlayer(
      (liveGame.actingPlayerIndex + 1) % liveGame.players.length,
      liveGame.players
    );
    const logMsg = `[Host Override] Skipped ${liveGame.players[liveGame.actingPlayerIndex]?.name}'s turn.`;
    await updateDbState({ ...liveGame, actingPlayerIndex: next, history: [...(liveGame.history || []), logMsg] });
  };

  const handleSeatCardClick = async (idx) => {
    if (!isAuthenticated) return;
    if (repositionMode === 'dealer') {
      const logMsg = `[Host Override] Dealer button moved to ${liveGame.players[idx]?.name}.`;
      await updateDbState({ ...liveGame, dealerIndex: idx, history: [...(liveGame.history || []), logMsg] });
      setRepositionMode(null);
    } else if (repositionMode === 'acting') {
      const logMsg = `[Host Override] Acting turn set to ${liveGame.players[idx]?.name}.`;
      await updateDbState({ ...liveGame, actingPlayerIndex: idx, history: [...(liveGame.history || []), logMsg] });
      setRepositionMode(null);
    }
  };

  const handleSaveStackEdit = async () => {
    if (!liveGame || !isAuthenticated || !editingStack) return;
    const { idx, value } = editingStack;
    const newStack = Math.max(0, Number(value) || 0);
    const player = liveGame.players[idx];
    if (!player) return;
    const logMsg = `[Manual Override] ${player.name}'s stack set to ${newStack.toLocaleString()} chips.`;
    const updatedPlayers = liveGame.players.map((p, i) =>
      i === idx ? { ...p, stack: newStack, outOfChips: newStack <= 0 } : p
    );
    await updateDbState({ ...liveGame, players: updatedPlayers, history: [...(liveGame.history || []), logMsg] });
    setEditingStack(null);
  };

  // ── Main action handler ───────────────────────────────────────────────────

  const handleAction = async (actionType, payload = null, targetTableId = activeTableId) => {
    const game = liveGames?.[targetTableId];
    if (!game?.active) return;
    if (game.actingPlayerIndex === undefined || game.actingPlayerIndex === -1) return;
    const actPlayer = game.players[game.actingPlayerIndex];
    if (!actPlayer) return;

    const isMyTurn = currentPlayerId && actPlayer.id === currentPlayerId;
    if (!isAuthenticated && !isMyTurn) return;

    const updatedPlayers = game.players.map(p => ({ ...p }));
    const player = updatedPlayers[game.actingPlayerIndex];
    let nextHighest = Number(game.highestBet);
    let nextPrevHighest = Number(game.previousHighestBet);
    let logMsg = '';

    player.hasActed = true;
    const currentPot = (game.pot || 0) + game.players.reduce((s, p) => s + (p.currentBet || 0), 0);

    if (actionType === 'FOLD') {
      player.folded = true;
      logMsg = `${player.name} folded.`;
    } else if (actionType === 'CHECK') {
      logMsg = `${player.name} checked.`;
    } else if (actionType === 'CALL') {
      if (game.stage === 'PRE_FLOP') player.vpip = true;
      const callAmount = nextHighest - player.currentBet;
      if (player.stack <= callAmount) {
        const actualCall = player.stack;
        player.currentBet += actualCall;
        player.totalHandInvestment += actualCall;
        player.stack = 0;
        player.isAllIn = true;
        logMsg = `${player.name} called all-in (${actualCall.toLocaleString()}).`;
      } else {
        player.stack -= callAmount;
        player.currentBet += callAmount;
        player.totalHandInvestment += callAmount;
        logMsg = `${player.name} called (${callAmount.toLocaleString()}).`;
      }
    } else if (actionType === 'RAISE') {
      if (game.stage === 'PRE_FLOP') {
        player.vpip = true;
        player.pfr = true;
      }
      const targetBet = Number(payload);
      const addedAmount = targetBet - player.currentBet;
      if (player.stack <= addedAmount) {
        const actualRaise = player.stack;
        player.currentBet += actualRaise;
        player.totalHandInvestment += actualRaise;
        player.stack = 0;
        player.isAllIn = true;
        nextPrevHighest = nextHighest;
        nextHighest = player.currentBet;
        logMsg = `${player.name} raised all-in to ${player.currentBet.toLocaleString()}.`;
      } else {
        player.stack -= addedAmount;
        player.currentBet += addedAmount;
        player.totalHandInvestment += addedAmount;
        nextPrevHighest = nextHighest;
        nextHighest = targetBet;
        logMsg = `${player.name} raised to ${targetBet.toLocaleString()}.`;
      }
      // Reset hasActed for all other active players
      updatedPlayers.forEach((p, idx) => {
        if (idx !== game.actingPlayerIndex) p.hasActed = false;
      });
    }

    // Auto-win if all others folded
    const unfoldedPlayers = updatedPlayers.filter(p => !p.folded);
    if (unfoldedPlayers.length === 1) {
      const winner = unfoldedPlayers[0];
      winner.stack += currentPot;
      const finishMsg = `${winner.name} won the pot of ${currentPot.toLocaleString()} chips (everyone else folded).`;
      const autoWinPayouts = { [winner.id]: currentPot };
      await writeHandLog(game, autoWinPayouts);
      const nextHandState = startNewHand({
        ...game,
        players: updatedPlayers,
        communityCards: [],
        handDealt: false,
        history: [...(game.history || []), logMsg, finishMsg],
      });
      await updateDbState(nextHandState, targetTableId);
      return;
    }

    const isRoundComplete = isBettingRoundComplete(updatedPlayers, nextHighest);
    const nextPlayerIdx = findNextActivePlayer(
      (game.actingPlayerIndex + 1) % updatedPlayers.length,
      updatedPlayers
    );

    await updateDbState({
      ...game,
      players: updatedPlayers,
      highestBet: nextHighest,
      previousHighestBet: nextPrevHighest,
      actingPlayerIndex: isRoundComplete ? -1 : nextPlayerIdx,
      history: [...(game.history || []), logMsg],
    }, targetTableId);
  };

  // ── Street progression ────────────────────────────────────────────────────

  const handleProceedNextStreet = async (communityCardsDelta = [], nextRemainingDeck = null) => {
    if (!liveGame || !isAuthenticated) return;

    await updateDbState((currentGame) => {
      if (!currentGame || !currentGame.active) return currentGame;

      const streetBets = currentGame.players.reduce((s, p) => s + (p.currentBet || 0), 0);
      const newPot = (currentGame.pot || 0) + streetBets;
      const updatedPlayers = currentGame.players.map(p => ({ ...p, currentBet: 0, hasActed: false }));

      const stageOrder = { PRE_FLOP: 'FLOP', FLOP: 'TURN', TURN: 'RIVER', RIVER: 'SHOWDOWN' };
      let nextStage = stageOrder[currentGame.stage] || 'SHOWDOWN';

      let nextActingIdx = -1;
      if (nextStage !== 'SHOWDOWN') {
        nextActingIdx = findNextActivePlayer(
          (currentGame.dealerIndex + 1) % updatedPlayers.length,
          updatedPlayers
        );
        const activeChipsCount = updatedPlayers.filter(p => !p.folded && !p.isAllIn && !p.outOfChips).length;
        if (activeChipsCount <= 1) { nextStage = 'SHOWDOWN'; nextActingIdx = -1; }
      }

      const logMsg = `Proceeded to ${nextStage.replace('_', ' ')}. Collected ${streetBets.toLocaleString()} bets. Pot: ${newPot.toLocaleString()}.`;

      let drawnCards = communityCardsDelta;
      let nextDeck = nextRemainingDeck !== null ? nextRemainingDeck : (currentGame.remainingDeck || []);

      // Auto-draw community cards from remainingDeck for Mode C (full_digital)
      if (currentGame.mode === 'full_digital' && nextStage !== 'SHOWDOWN' && drawnCards.length === 0) {
        let count = 0;
        if (currentGame.stage === 'PRE_FLOP') count = 3;   // Flop
        else if (currentGame.stage === 'FLOP') count = 1; // Turn
        else if (currentGame.stage === 'TURN') count = 1; // River

        if (count > 0) {
          if (nextDeck.length < count + 1) {
            const freshDeck = shuffleDeck(buildDeck());
            const { remaining } = dealHoleCards(freshDeck, currentGame.players || []);
            nextDeck = remaining;
          }
          const drawn = dealCommunityCards(nextDeck, count);
          drawnCards = drawn.cards;
          nextDeck = drawn.remaining;
        }
      }

      const nextCommunity = drawnCards.length > 0
        ? [...(currentGame.communityCards || []), ...drawnCards]
        : (currentGame.communityCards || []);

      return {
        ...currentGame,
        stage: nextStage,
        pot: newPot,
        highestBet: 0,
        previousHighestBet: 0,
        actingPlayerIndex: nextActingIdx,
        players: updatedPlayers,
        communityCards: nextCommunity,
        remainingDeck: nextDeck,
        history: [...(currentGame.history || []), logMsg],
      };
    });

    setSelectedWinners([]);
    setWinnerPayouts({});
  };

  // ── Hand Log writer ───────────────────────────────────────────────────────

  const writeHandLog = async (gameState, winnerPayoutsMap) => {
    if (!gameState || !activeTableId) return;
    try {
      const handLogRef = doc(
        collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', activeTableId, 'handLogs')
      );
      const playerSummary = (gameState.players || []).map(p => {
        const payout = Number(winnerPayoutsMap?.[p.id] || 0);
        const invested = Number(p.totalHandInvestment || 0);
        return {
          id: p.id,
          name: p.name,
          netChips: payout - invested,
          finalStack: (p.stack || 0) + payout,
          vpip: p.vpip || false,
          pfr: p.pfr || false,
          isWinner: payout > 0,
        };
      });
      const handLog = {
        handNumber: gameState.handNumber,
        tableId: activeTableId,
        mode: gameState.mode || 'chips_only',
        pot: (gameState.pot || 0) + (gameState.players || []).reduce((s, p) => s + (p.currentBet || 0), 0),
        stageAtFinish: gameState.stage,
        timestamp: new Date().toISOString(),
        playerSummary,
        // Card data — only populated in full_digital mode
        communityCards: gameState.mode === 'full_digital' ? (gameState.communityCards || []) : [],
        evaluations: gameState.mode === 'full_digital' ? (gameState.showdownResult?.evaluations || null) : null,
      };
      await setDoc(handLogRef, handLog);
    } catch (err) {
      console.warn('Failed to write hand log (non-fatal):', err.message);
    }
  };

  // ── Showdown award ────────────────────────────────────────────────────────

  const handleAwardShowdown = async () => {
    if (!liveGame || !isAuthenticated) return;
    const totalPayout = Object.values(winnerPayouts).reduce((s, v) => s + Number(v || 0), 0);
    if (totalPayout !== totalLivePot) {
      alert(`Invalid payouts: sum (${totalPayout.toLocaleString()}) must equal pot (${totalLivePot.toLocaleString()}).`);
      return;
    }
    await writeHandLog(liveGame, winnerPayouts);
    const updatedPlayers = liveGame.players.map(p => ({
      ...p,
      stack: p.stack + Number(winnerPayouts[p.id] || 0),
    }));
    const payoutLogs = Object.entries(winnerPayouts)
      .filter(([, amt]) => Number(amt) > 0)
      .map(([id, amt]) => `${liveGame.players.find(p => p.id === id)?.name || id} won ${Number(amt).toLocaleString()}`);
    const nextHandState = startNewHand({
      ...liveGame,
      players: updatedPlayers,
      communityCards: [],
      handDealt: false,
      history: [...(liveGame.history || []), `Showdown: ${payoutLogs.join(', ')}.`],
    });
    await updateDbState(nextHandState);
    setSelectedWinners([]);
    setWinnerPayouts({});
  };

  // ── Manual chip adjustment ────────────────────────────────────────────────

  const handleManualAdjustment = async () => {
    if (!liveGame || !manualAdjustPlayer || !isAuthenticated) return;
    const amount = Number(manualAdjustAmount);
    if (isNaN(amount) || amount === 0) return;
    const updatedPlayers = liveGame.players.map(p => {
      if (p.id === manualAdjustPlayer) {
        const nextStack = Math.max(0, p.stack + amount);
        return { ...p, stack: nextStack, outOfChips: nextStack <= 0 };
      }
      return p;
    });
    const name = liveGame.players.find(p => p.id === manualAdjustPlayer)?.name || manualAdjustPlayer;
    const sign = amount > 0 ? '+' : '';
    const logMsg = `[Manual Override] ${name} stack adjusted by ${sign}${amount.toLocaleString()} (${manualAdjustReason}).`;
    await updateDbState({ ...liveGame, players: updatedPlayers, history: [...(liveGame.history || []), logMsg] });
    setManualAdjustAmount('');
    setShowManualPanel(false);
  };

  // ── Open Lobby ────────────────────────────────────────────────────────────

  const handleOpenLobby = async (mode = 'chips_only') => {
    if (!isAuthenticated) return;
    const lobbyState = {
      active: true,
      stage: 'LOBBY',
      handNumber: 0,
      players: [],
      pot: 0,
      highestBet: 0,
      previousHighestBet: 0,
      actingPlayerIndex: -1,
      dealerIndex: 0,
      smallBlind: Number(sbAmount),
      bigBlind: Number(bbAmount),
      mode,
      communityCards: [],
      handDealt: false,
      remainingDeck: [],
      processedDeclarations: {},
      history: ['Lobby opened. Waiting for players to join.'],
      lastUpdated: new Date().toISOString(),
    };
    try {
      await setDoc(gameDocRef, lobbyState);
    } catch (err) {
      console.error('Error opening lobby:', err);
    }
  };

  // ── Start game ────────────────────────────────────────────────────────────

  const handleStartGame = async (mode = liveGame?.mode || 'chips_only') => {
    if (!liveGame || !isAuthenticated) return;
    const joinedPlayers = liveGame.players || [];
    if (joinedPlayers.length < 2) {
      alert('Need at least 2 players to start. Ask players to join from their dashboards.');
      return;
    }
    const activeRoster = joinedPlayers.map(p => ({
      ...p,
      currentBet: 0,
      totalHandInvestment: 0,
      folded: false,
      isAllIn: false,
      outOfChips: p.stack <= 0,
      hasActed: false,
    }));
    const processedDecs = {};
    activeRoster.forEach(p => {
      processedDecs[p.id] = {
        buyIn: Number(liveGame.processedDeclarations?.[p.id]?.buyIn || p.stack),
        rebuys: Number(liveGame.processedDeclarations?.[p.id]?.rebuys || 0),
      };
    });
    const dealerIdx = activeRoster.findIndex(p => p.id === initialDealerId);
    const initialState = {
      ...liveGame,
      active: true,
      handNumber: 0,
      stage: 'SETUP',
      dealerIndex: dealerIdx !== -1 ? dealerIdx : 0,
      smallBlind: Number(sbAmount),
      bigBlind: Number(bbAmount),
      pot: 0,
      highestBet: 0,
      previousHighestBet: 0,
      actingPlayerIndex: -1,
      players: activeRoster,
      processedDeclarations: processedDecs,
      mode,
      communityCards: [],
      handDealt: false,
      remainingDeck: [],
      history: [...(liveGame.history || []), 'Game started by host.'],
    };
    const firstHandState = startNewHand(initialState);
    await updateDbState(firstHandState);
    setUndoCount(0);
  };

  // ── Reset game ────────────────────────────────────────────────────────────

  const handleResetGame = async () => {
    if (!window.confirm('Reset/delete the current table? This removes all stacks and history.')) return;
    try {
      await deleteDoc(gameDocRef);
      const remaining = Object.keys(liveGames || {}).filter(k => k !== activeTableId && liveGames[k]?.active);
      setActiveTableId(remaining.length > 0 ? remaining[0] : 'main');
      setUndoCount(0);
    } catch (err) { console.error(err); }
  };

  // ── Save to ledger ────────────────────────────────────────────────────────

  const handleSaveToLedger = async () => {
    if (!isAuthenticated || !liveGames) return;
    const latestSession = sessions?.length > 0 ? sessions[0] : null;
    if (!latestSession || latestSession.status !== 'active') {
      alert('No active session found. Please start a day in the Daily Ledger tab first.');
      return;
    }
    if (!window.confirm('End all live table games and save final stacks as cash-out drafts?')) return;
    try {
      for (const [tableId, game] of Object.entries(liveGames)) {
        if (!game?.active || !game.players) continue;
        for (const p of game.players) {
          const refundedStack = Number(p.stack || 0) + Number(p.currentBet || 0);
          await recordRealtimeCashOut(db, safeAppId, p.id, refundedStack, latestSession.dayNumber, 'admin');
        }
        await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', tableId));
      }
      alert(`All games ended! Final stacks saved as cash-out drafts for Day ${latestSession.dayNumber}.`);
    } catch (err) {
      console.error('Error saving to ledger:', err);
      alert('Failed to save to ledger.');
    }
  };

  // ── Table management ──────────────────────────────────────────────────────

  const handleTableSwap = async (playerId, targetTableId) => {
    if (!isAuthenticated || !liveGames) return;
    let currentTableId = null;
    let playerObj = null;
    Object.entries(liveGames).forEach(([tId, game]) => {
      if (!game?.active || !game.players) return;
      const found = game.players.find(p => p.id === playerId);
      if (found) { currentTableId = tId; playerObj = found; }
    });
    if (currentTableId === targetTableId) return;
    try {
      const dec = playerDeclarations?.[playerId];
      let stack = 0;
      if (playerObj) {
        stack = playerObj.stack;
      } else if (dec) {
        stack = Number(dec.buyIn || 0) + Number(dec.rebuys || 0);
      } else {
        const pCfg = config.players.find(p => p.id === playerId);
        stack = Number(pCfg?.startBalance ?? 0);
      }

      if (currentTableId) {
        const currentGame = liveGames[currentTableId];
        const result = removePlayers(
          currentGame.players, [playerId],
          currentGame.dealerIndex, currentGame.actingPlayerIndex
        );
        const nextProcessed = { ...(currentGame.processedDeclarations || {}) };
        delete nextProcessed[playerId];
        const logMsg = `[Table Swap] ${playerObj?.name || playerId} moved to Table ${targetTableId === 'main' ? '1' : targetTableId.split('_')[1] || targetTableId}.`;
        await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', currentTableId), {
          ...currentGame,
          players: result.players,
          dealerIndex: result.dealerIndex,
          actingPlayerIndex: result.actingPlayerIndex,
          processedDeclarations: nextProcessed,
          history: [...(currentGame.history || []), logMsg],
          lastUpdated: new Date().toISOString(),
        });
      }

      const targetGame = liveGames[targetTableId];
      const isHandRunning = targetGame.stage !== 'SETUP' && targetGame.stage !== 'SHOWDOWN';
      const playerDetails = config.players.find(p => p.id === playerId);
      const name = playerDetails?.name || playerId;
      const newPlayer = {
        id: playerId, name, stack,
        currentBet: 0, totalHandInvestment: 0,
        folded: isHandRunning, isAllIn: false, outOfChips: false, hasActed: isHandRunning,
      };
      const nextTargetProcessed = {
        ...(targetGame.processedDeclarations || {}),
        [playerId]: {
          buyIn: dec?.buyIn !== undefined ? Number(dec.buyIn) : stack,
          rebuys: dec?.rebuys !== undefined ? Number(dec.rebuys) : 0,
        },
      };
      const joinMsg = `[Table Swap] ${name} joined from Table ${currentTableId === 'main' ? '1' : (currentTableId?.split('_')[1] || 'None')} with ${stack.toLocaleString()} chips.`;
      await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', targetTableId), {
        ...targetGame,
        players: [...(targetGame.players || []), newPlayer],
        processedDeclarations: nextTargetProcessed,
        history: [...(targetGame.history || []), joinMsg],
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) { console.error('Error swapping tables:', err); }
  };

  const handleSplitTable = async (playerIdsToMove, targetTableId) => {
    if (!liveGame || playerIdsToMove.length === 0) return;
    try {
      const playersToMove = liveGame.players.filter(p => playerIdsToMove.includes(p.id));
      if (liveGame.players.length - playersToMove.length < 1) {
        alert('At least 1 player must remain at the current table.');
        return;
      }
      const targetGame = {
        active: true, handNumber: 1, stage: 'SETUP',
        dealerIndex: 0, smallBlind: liveGame.smallBlind || 10, bigBlind: liveGame.bigBlind || 50,
        pot: 0, highestBet: 0, previousHighestBet: 0, actingPlayerIndex: -1,
        mode: liveGame.mode || 'chips_only',
        communityCards: [], handDealt: false, remainingDeck: [],
        players: playersToMove.map(p => ({
          ...p, currentBet: 0, totalHandInvestment: 0,
          folded: false, isAllIn: false, outOfChips: false, hasActed: false,
        })),
        processedDeclarations: playersToMove.reduce((acc, p) => ({
          ...acc,
          [p.id]: liveGame.processedDeclarations?.[p.id] || { buyIn: p.stack, rebuys: 0 },
        }), {}),
        history: [`Table split from Table ${activeTableId === 'main' ? '1' : activeTableId.split('_')[1] || activeTableId}. Players: ${playersToMove.map(p => p.name).join(', ')}.`],
        lastUpdated: new Date().toISOString(),
      };
      await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', targetTableId), targetGame);
      const result = removePlayers(
        liveGame.players, playerIdsToMove,
        liveGame.dealerIndex, liveGame.actingPlayerIndex
      );
      const currentProcessed = { ...(liveGame.processedDeclarations || {}) };
      playerIdsToMove.forEach(id => delete currentProcessed[id]);
      const logMsg = `Table split: moved ${playersToMove.map(p => p.name).join(', ')} to Table ${targetTableId.split('_')[1] || targetTableId}.`;
      await setDoc(gameDocRef, {
        ...liveGame,
        players: result.players,
        dealerIndex: result.dealerIndex,
        actingPlayerIndex: result.actingPlayerIndex,
        processedDeclarations: currentProcessed,
        history: [...(liveGame.history || []), logMsg],
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error splitting table:', err);
      alert('Failed to split table.');
    }
  };

  return {
    // Setup state
    selectedPlayers, setSelectedPlayers,
    startingStacks, setStartingStacks,
    sbAmount, setSbAmount,
    bbAmount, setBbAmount,
    initialDealerId, setInitialDealerId,
    // Showdown state
    selectedWinners, winnerPayouts,
    // Host override state
    repositionMode, setRepositionMode,
    editingStack, setEditingStack,
    undoCount,
    // Manual adj state
    showManualPanel, setShowManualPanel,
    manualAdjustPlayer, setManualAdjustPlayer,
    manualAdjustAmount, setManualAdjustAmount,
    manualAdjustReason, setManualAdjustReason,
    // Table management
    addPlayerStacks, setAddPlayerStacks,
    // Derived
    liveGame, gameDocRef, tablePlayers,
    totalLivePot, isStreetSettled, actingPlayer, minRaiseTo,
    // Handlers
    handleOpenLobby,
    handleStartGame,
    handleAction,
    handleProceedNextStreet,
    handleAwardShowdown,
    handleManualAdjustment,
    handleResetGame,
    handleSaveToLedger,
    handleUndo,
    handleSkipTurn,
    handleSeatCardClick,
    handleSaveStackEdit,
    handleWinnerToggle,
    handlePayoutChange,
    handleTableSwap,
    handleSplitTable,
    updateDbState,
  };
}
