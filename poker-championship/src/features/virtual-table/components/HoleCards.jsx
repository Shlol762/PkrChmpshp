import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';
import CardDisplay from './CardDisplay';

/**
 * Shows the hole cards for a specific player.
 * - If cards have not been dealt by host (cards is null), renders empty placeholder slots
 * - If currentPlayerId matches, shows their cards face up
 * - If isAuthenticated (host), shows all cards face up
 * - If isViewerFolded (current viewer has folded or is spectating), shows ALL cards face up!
 * - Otherwise shows card backs for active opponents
 */
export default function HoleCards({
  activeTableId,
  currentPlayerId,
  isAuthenticated,
  isSpectator,
  isViewerFolded,
  playerId,
  handNumber,
  size = 'sm'
}) {
  const [cards, setCards] = useState(null);

  useEffect(() => {
    if (!activeTableId) return;
    const ref = doc(db, 'artifacts', safeAppId, 'public', 'data', 'holeCards', activeTableId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Show cards if holeCards doc matches current handNumber or if handNumber isn't set yet
        if (!handNumber || data._handNumber === handNumber) {
          setCards(data[playerId] || null);
        } else {
          setCards(null);
        }
      } else {
        setCards(null);
      }
    });
    return () => unsub();
  }, [activeTableId, playerId, handNumber]);

  // Folded players & spectators can see everyone's cards (both active & folded)
  const canSeeCards = isAuthenticated || isSpectator || isViewerFolded || currentPlayerId === playerId;

  if (!cards) {
    return (
      <div className="flex gap-1.5 items-center">
        <div className="w-8 h-12 rounded-lg border border-dashed border-white/15 bg-zinc-950/40 flex items-center justify-center text-[8px] text-zinc-600 font-mono uppercase tracking-tighter">No</div>
        <div className="w-8 h-12 rounded-lg border border-dashed border-white/15 bg-zinc-950/40 flex items-center justify-center text-[8px] text-zinc-600 font-mono uppercase tracking-tighter">Deal</div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {cards.map((card, i) => (
        <CardDisplay key={i} card={card} faceDown={!canSeeCards} size={size} />
      ))}
    </div>
  );
}
