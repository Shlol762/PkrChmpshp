/**
 * cardEngine.js
 * Pure functions for building, shuffling, and dealing a standard 52-card deck.
 * Used by Mode C (fully digital) of the Virtual Table.
 *
 * Card representation: 2-char string  →  rank + suit
 *   Ranks : 2 3 4 5 6 7 8 9 T J Q K A
 *   Suits : s (spades) h (hearts) d (diamonds) c (clubs)
 *   e.g.  : 'As' = Ace of Spades, 'Td' = Ten of Diamonds
 */

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];

/** Returns a full unshuffled 52-card deck. */
export function buildDeck() {
  return RANKS.flatMap(r => SUITS.map(s => r + s));
}

/** Fisher-Yates shuffle — returns a new shuffled array, does not mutate input. */
export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * Draw `count` cards from the front of the deck.
 * @returns {{ cards: string[], remaining: string[] }}
 */
export function dealCards(deck, count) {
  return {
    cards: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

/**
 * Deal 2 hole cards to each active (non-out-of-chips) player.
 * @param {string[]} deck - shuffled deck to deal from
 * @param {object[]} players - player list from game state
 * @returns {{ assignments: Record<string, [string,string]>, remaining: string[] }}
 */
export function dealHoleCards(deck, players) {
  const assignments = {};
  let remaining = [...deck];
  const activePlayers = players.filter(p => !p.outOfChips);
  activePlayers.forEach(p => {
    const { cards, remaining: rest } = dealCards(remaining, 2);
    assignments[p.id] = cards;
    remaining = rest;
  });
  return { assignments, remaining };
}

/**
 * Burn one card then deal `count` community cards (standard poker protocol).
 * FLOP: count=3, TURN: count=1, RIVER: count=1
 * @returns {{ cards: string[], remaining: string[] }}
 */
export function dealCommunityCards(deck, count) {
  const afterBurn = deck.slice(1); // discard top card (burn)
  return {
    cards: afterBurn.slice(0, count),
    remaining: afterBurn.slice(count),
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLORS  = { s: '#e2e8f0', h: '#ef4444', d: '#ef4444', c: '#e2e8f0' };
export const SUIT_LABELS  = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' };

export function getRank(card) { return card?.slice(0, -1) ?? ''; }
export function getSuit(card) { return card?.slice(-1) ?? ''; }
export function displayRank(rank) {
  return rank === 'T' ? '10' : (rank ?? '');
}
