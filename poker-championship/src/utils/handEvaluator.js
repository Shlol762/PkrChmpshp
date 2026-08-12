/**
 * Texas Hold'em 7-Card Hand Evaluator
 * Evaluates 2 hole cards + 5 community cards to determine hand rank & score.
 */

const RANKS = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const HAND_TYPES = {
  STRAIGHT_FLUSH: 9,
  FOUR_OF_A_KIND: 8,
  FULL_HOUSE: 7,
  FLUSH: 6,
  STRAIGHT: 5,
  THREE_OF_A_KIND: 4,
  TWO_PAIR: 3,
  ONE_PAIR: 2,
  HIGH_CARD: 1,
};

const HAND_NAMES = {
  9: 'Straight Flush',
  8: 'Four of a Kind',
  7: 'Full House',
  6: 'Flush',
  5: 'Straight',
  4: 'Three of a Kind',
  3: 'Two Pair',
  2: 'One Pair',
  1: 'High Card',
};

const RANK_NAMES = {
  14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten',
  9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five',
  4: 'Four', 3: 'Three', 2: 'Two'
};

const RANK_PLURALS = {
  14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens',
  9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives',
  4: 'Fours', 3: 'Threes', 2: 'Twos'
};

function parseCard(cardStr) {
  if (!cardStr) return null;
  const str = cardStr.trim();
  const suitChar = str.slice(-1).toLowerCase();
  const rankStr = str.slice(0, -1);
  const rankVal = RANKS[rankStr.toUpperCase()] || Number(rankStr);
  return { rank: rankVal, suit: suitChar, raw: str };
}

// Generate all 5-card combinations out of 7
function combinations(arr, k = 5) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = combinations(tail, k - 1).map(c => [head, ...c]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

// Evaluate a 5-card hand
function evaluate5Cards(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      isStraight = true;
      straightHigh = 5; // 5-high straight (A-2-3-4-5)
    }
  }

  // Count rank frequencies
  const counts = {};
  ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1; });

  const freqEntries = Object.entries(counts)
    .map(([r, count]) => ({ rank: Number(r), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 1. Straight Flush
  if (isFlush && isStraight) {
    return {
      type: HAND_TYPES.STRAIGHT_FLUSH,
      score: [HAND_TYPES.STRAIGHT_FLUSH, straightHigh],
      descr: straightHigh === 14 ? 'Royal Flush' : `${RANK_NAMES[straightHigh]}-High Straight Flush`,
    };
  }

  // 2. Four of a Kind
  if (freqEntries[0].count === 4) {
    const quad = freqEntries[0].rank;
    const kicker = freqEntries[1].rank;
    return {
      type: HAND_TYPES.FOUR_OF_A_KIND,
      score: [HAND_TYPES.FOUR_OF_A_KIND, quad, kicker],
      descr: `Four of a Kind, ${RANK_PLURALS[quad]} (${RANK_NAMES[kicker]} Kicker)`,
    };
  }

  // 3. Full House
  if (freqEntries[0].count === 3 && freqEntries[1].count === 2) {
    const trip = freqEntries[0].rank;
    const pair = freqEntries[1].rank;
    return {
      type: HAND_TYPES.FULL_HOUSE,
      score: [HAND_TYPES.FULL_HOUSE, trip, pair],
      descr: `Full House, ${RANK_PLURALS[trip]} full of ${RANK_PLURALS[pair]}`,
    };
  }

  // 4. Flush
  if (isFlush) {
    const kickerStr = ranks.slice(1).map(r => RANK_NAMES[r]).join(', ');
    return {
      type: HAND_TYPES.FLUSH,
      score: [HAND_TYPES.FLUSH, ...ranks],
      descr: `Flush, ${RANK_NAMES[ranks[0]]}-High (${kickerStr})`,
    };
  }

  // 5. Straight
  if (isStraight) {
    return {
      type: HAND_TYPES.STRAIGHT,
      score: [HAND_TYPES.STRAIGHT, straightHigh],
      descr: `Straight, ${RANK_NAMES[straightHigh]}-High`,
    };
  }

  // 6. Three of a Kind
  if (freqEntries[0].count === 3) {
    const trip = freqEntries[0].rank;
    const kickers = freqEntries.slice(1).map(e => e.rank);
    const kickerStr = kickers.map(r => RANK_NAMES[r]).join(', ');
    return {
      type: HAND_TYPES.THREE_OF_A_KIND,
      score: [HAND_TYPES.THREE_OF_A_KIND, trip, ...kickers],
      descr: `Three of a Kind, ${RANK_PLURALS[trip]} (${kickerStr} Kickers)`,
    };
  }

  // 7. Two Pair
  if (freqEntries[0].count === 2 && freqEntries[1].count === 2) {
    const p1 = freqEntries[0].rank;
    const p2 = freqEntries[1].rank;
    const kicker = freqEntries[2].rank;
    return {
      type: HAND_TYPES.TWO_PAIR,
      score: [HAND_TYPES.TWO_PAIR, p1, p2, kicker],
      descr: `Two Pair, ${RANK_PLURALS[p1]} and ${RANK_PLURALS[p2]} (${RANK_NAMES[kicker]} Kicker)`,
    };
  }

  // 8. One Pair
  if (freqEntries[0].count === 2) {
    const p = freqEntries[0].rank;
    const kickers = freqEntries.slice(1).map(e => e.rank);
    const kickerStr = kickers.map(r => RANK_NAMES[r]).join(', ');
    return {
      type: HAND_TYPES.ONE_PAIR,
      score: [HAND_TYPES.ONE_PAIR, p, ...kickers],
      descr: `Pair of ${RANK_PLURALS[p]} (${kickerStr} Kickers)`,
    };
  }

  // 9. High Card
  const kickerStr = ranks.slice(1).map(r => RANK_NAMES[r]).join(', ');
  return {
    type: HAND_TYPES.HIGH_CARD,
    score: [HAND_TYPES.HIGH_CARD, ...ranks],
    descr: `High Card ${RANK_NAMES[ranks[0]]} (${kickerStr})`,
  };
}

/**
 * Compare two score arrays lexically.
 * Returns positive if scoreA > scoreB, negative if scoreA < scoreB, 0 if tie.
 */
export function compareScores(scoreA, scoreB) {
  for (let i = 0; i < Math.max(scoreA.length, scoreB.length); i++) {
    const a = scoreA[i] || 0;
    const b = scoreB[i] || 0;
    if (a !== b) return a - b;
  }
  return 0;
}

/**
 * Evaluates 7 cards (2 hole + 5 community) and returns the best 5-card hand.
 */
export function evaluate7CardHand(holeCards = [], communityCards = []) {
  const allCards = [...holeCards, ...communityCards].map(parseCard).filter(Boolean);
  if (allCards.length < 5) {
    return { type: 0, score: [0], descr: 'Not enough cards' };
  }

  const combis = combinations(allCards, 5);
  let best = null;

  for (const comb of combis) {
    const evalResult = evaluate5Cards(comb);
    if (!best || compareScores(evalResult.score, best.score) > 0) {
      best = evalResult;
    }
  }

  return best;
}

/**
 * Evaluates all active players' hands given holeCards mapping & communityCards.
 * Returns array of objects sorted best to worst:
 * [{ playerId, handName: '...', score: [...], isWinner: boolean }, ...]
 */
export function evaluateShowdown(players = [], holeCardsMap = {}, communityCards = []) {
  const activePlayers = players.filter(p => !p.folded);
  if (activePlayers.length === 0) return { playerEvaluations: [], winningPlayerIds: [] };

  const evaluations = activePlayers.map(p => {
    const pHoleCards = holeCardsMap[p.id] || [];
    const hand = evaluate7CardHand(pHoleCards, communityCards);
    return {
      playerId: p.id,
      name: p.name,
      handName: hand.descr,
      score: hand.score,
      holeCards: pHoleCards,
    };
  });

  // Sort descending by score
  evaluations.sort((a, b) => compareScores(b.score, a.score));

  // Identify top winner(s) (supports split pots if scores match)
  const topScore = evaluations[0]?.score || [];
  const winners = evaluations.filter(e => compareScores(e.score, topScore) === 0);
  const winningPlayerIds = winners.map(w => w.playerId);

  return {
    evaluations: evaluations.map(e => ({
      ...e,
      isWinner: winningPlayerIds.includes(e.playerId),
    })),
    winningPlayerIds,
  };
}
