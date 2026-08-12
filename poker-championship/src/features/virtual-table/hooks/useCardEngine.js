import { doc, setDoc } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';
import { buildDeck, shuffleDeck, dealHoleCards, dealCommunityCards } from '../../../utils/cardEngine';

/**
 * Returns card-dealing actions for Mode C (fully digital).
 * The host calls these functions; they write to Firestore.
 */
export function useCardEngine({ isAuthenticated, liveGame, activeTableId, updateDbState }) {
  /**
   * Shuffle a new deck and deal 2 hole cards to each active player.
   * Hole cards written to holeCards/{tableId} (trust-based privacy).
   * Remaining deck stored in game doc for community card draws.
   */
  const handleDealCards = async () => {
    if (!liveGame || !isAuthenticated) return;

    const deck = shuffleDeck(buildDeck());
    const { assignments, remaining } = dealHoleCards(deck, liveGame.players || []);

    // Write hole cards to separate collection (client-side trust model)
    const holeCardsRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'holeCards', activeTableId);
    await setDoc(holeCardsRef, {
      ...assignments,
      _handNumber: liveGame.handNumber,
      _updatedAt: new Date().toISOString(),
    });

    const logMsg = `[Mode C] Cards dealt for Hand #${liveGame.handNumber}. ${Object.keys(assignments).length} players received hole cards.`;
    await updateDbState({
      ...liveGame,
      remainingDeck: remaining,
      handDealt: true,
      history: [...(liveGame.history || []), logMsg],
    });
    return { assignments, remaining };
  };

  /**
   * Draw community cards for the next street.
   * Caller is responsible for passing these into handleProceedNextStreet.
   * FLOP: count=3, TURN: count=1, RIVER: count=1
   * Auto-fallback: Generates a fresh deck if remainingDeck is depleted or empty!
   * @returns {{ cards: string[], remaining: string[] } | null}
   */
  const handleDealCommunity = async (count) => {
    if (!liveGame || !isAuthenticated) return null;
    let deck = liveGame.remainingDeck || [];

    // Fallback: If deck is depleted or empty (e.g. fresh hand started without manual deal button click), generate a fresh deck!
    if (deck.length < count + 1) {
      const freshDeck = shuffleDeck(buildDeck());
      const { assignments, remaining } = dealHoleCards(freshDeck, liveGame.players || []);
      deck = remaining;

      // Auto-save hole cards if not dealt yet
      const holeCardsRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'holeCards', activeTableId);
      await setDoc(holeCardsRef, {
        ...assignments,
        _handNumber: liveGame.handNumber,
        _updatedAt: new Date().toISOString(),
      });
    }

    const { cards, remaining } = dealCommunityCards(deck, count);
    return { cards, remaining };
  };

  return { handleDealCards, handleDealCommunity };
}
