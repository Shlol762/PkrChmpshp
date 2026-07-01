export function findNextActivePlayer(startIndex, players) {
  const N = players.length;
  for (let i = 0; i < N; i++) {
    const idx = (startIndex + i) % N;
    const p = players[idx];
    if (!p.folded && !p.isAllIn && !p.outOfChips) {
      return idx;
    }
  }
  return -1;
}

export function calculateSuggestedPayouts(players, winners) {
  const payouts = {};
  players.forEach(p => { payouts[p.id] = 0; });

  if (!winners || winners.length === 0) return payouts;

  const activePlayers = players.map(p => ({
    id: p.id,
    name: p.name,
    investment: Number(p.totalHandInvestment || 0),
    folded: p.folded,
    isWinner: winners.includes(p.id)
  })).filter(p => p.investment > 0);

  activePlayers.sort((a, b) => a.investment - b.investment);

  let prevInvestment = 0;
  
  for (let i = 0; i < activePlayers.length; i++) {
    const currentInvestment = activePlayers[i].investment;
    const diff = currentInvestment - prevInvestment;
    if (diff <= 0) continue;

    const contributors = activePlayers.slice(i);
    const tierPot = diff * contributors.length;
    const eligibleWinners = contributors.filter(c => c.isWinner && !c.folded);

    if (eligibleWinners.length > 0) {
      const splitAmount = Math.floor(tierPot / eligibleWinners.length);
      const remainder = tierPot % eligibleWinners.length;
      
      eligibleWinners.forEach((ew, idx) => {
        payouts[ew.id] += splitAmount + (idx === 0 ? remainder : 0);
      });
    } else {
      // Refund contributions of this tier if no eligible winner
      const splitRefund = Math.floor(tierPot / contributors.length);
      const remainder = tierPot % contributors.length;
      contributors.forEach((c, idx) => {
        payouts[c.id] += splitRefund + (idx === 0 ? remainder : 0);
      });
    }

    prevInvestment = currentInvestment;
  }

  return payouts;
}

export function isBettingRoundComplete(players, highestBet) {
  // Count how many players are still active (can make actions: not folded, not all-in, and have chips)
  const activePlayers = players.filter(p => !p.folded && !p.isAllIn && !p.outOfChips);
  
  // If there's 1 or 0 players who can make actions, the betting round is complete (or hand is over)
  if (activePlayers.length <= 1) {
    return true;
  }

  // All active players must have acted, and their currentBet must equal highestBet
  const allActedAndMatch = activePlayers.every(p => p.hasActed && Number(p.currentBet) === Number(highestBet));
  return allActedAndMatch;
}

export function startNewHand(state) {
  const { players, smallBlind, bigBlind } = state;
  const N = players.length;

  // 1. Advance Dealer Button
  let nextDealerIndex = (state.dealerIndex + 1) % N;
  // Make sure dealer has chips/is active
  while (players[nextDealerIndex].outOfChips) {
    nextDealerIndex = (nextDealerIndex + 1) % N;
    if (nextDealerIndex === state.dealerIndex) break; // backup safety
  }

  // 2. Reset Player Hand States
  const updatedPlayers = players.map(p => {
    const isOut = p.stack <= 0;
    return {
      ...p,
      currentBet: 0,
      totalHandInvestment: 0,
      folded: isOut,
      isAllIn: false,
      outOfChips: isOut,
      hasActed: false
    };
  });

  // Check if we have at least 2 active players left
  const activeCount = updatedPlayers.filter(p => !p.outOfChips).length;
  if (activeCount < 2) {
    return {
      ...state,
      players: updatedPlayers,
      dealerIndex: nextDealerIndex,
      active: false,
      stage: 'SETUP',
      history: [...state.history, "Game ended: Not enough active players left."]
    };
  }

  // 3. Post Blinds
  let sbIndex, bbIndex;
  const activeList = [];
  // Find order of active players starting from (nextDealerIndex + 1) % N
  for (let i = 1; i <= N; i++) {
    const idx = (nextDealerIndex + i) % N;
    if (!updatedPlayers[idx].outOfChips) {
      activeList.push(idx);
    }
  }

  if (activeList.length === 2) {
    // Heads Up: Dealer is SB, other player is BB
    sbIndex = nextDealerIndex;
    bbIndex = activeList.find(idx => idx !== nextDealerIndex);
  } else {
    sbIndex = activeList[0];
    bbIndex = activeList[1];
  }

  // Post SB
  const sbPlayer = updatedPlayers[sbIndex];
  const sbPosted = Math.min(sbPlayer.stack, smallBlind);
  sbPlayer.stack -= sbPosted;
  sbPlayer.currentBet = sbPosted;
  sbPlayer.totalHandInvestment = sbPosted;
  if (sbPlayer.stack === 0) sbPlayer.isAllIn = true;

  // Post BB
  const bbPlayer = updatedPlayers[bbIndex];
  const bbPosted = Math.min(bbPlayer.stack, bigBlind);
  bbPlayer.stack -= bbPosted;
  bbPlayer.currentBet = bbPosted;
  bbPlayer.totalHandInvestment = bbPosted;
  if (bbPlayer.stack === 0) bbPlayer.isAllIn = true;

  const highestBet = Math.max(sbPosted, bbPosted, bigBlind);
  
  // Pre-flop action starts after BB
  let preFlopStartIdx;
  if (activeList.length === 2) {
    preFlopStartIdx = sbIndex; // Heads up: Dealer/SB acts first pre-flop
  } else {
    // 3+ players: start with the player after BB
    const bbListIdx = activeList.indexOf(bbIndex);
    preFlopStartIdx = activeList[(bbListIdx + 1) % activeList.length];
  }

  const actingPlayerIndex = findNextActivePlayer(preFlopStartIdx, updatedPlayers);

  const historyMsg = `Hand #${state.handNumber + 1} started. ${sbPlayer.name} posted SB (${sbPosted}), ${bbPlayer.name} posted BB (${bbPosted}).`;

  return {
    ...state,
    handNumber: state.handNumber + 1,
    stage: 'PRE_FLOP',
    dealerIndex: nextDealerIndex,
    players: updatedPlayers,
    pot: sbPosted + bbPosted,
    highestBet,
    previousHighestBet: 0,
    actingPlayerIndex,
    history: [...state.history, historyMsg]
  };
}
