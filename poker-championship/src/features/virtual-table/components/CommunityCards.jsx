import CardDisplay from './CardDisplay';
import { Eye } from 'lucide-react';

/**
 * Displays the community board cards.
 * Slots: 5 total (3 flop + 1 turn + 1 river)
 * If viewer is folded, host, or spectator in Mode C:
 *   Previews future community cards (including the river) drawn from remainingDeck!
 */
export default function CommunityCards({ communityCards = [], remainingDeck = [], stage, isViewerFolded = false }) {
  const slots = Array(5).fill(null);
  const isPreview = Array(5).fill(false);

  // Fill officially dealt cards
  communityCards.forEach((card, i) => {
    slots[i] = card;
  });

  // Calculate future card previews if viewer has folded or is spectating/host
  if (isViewerFolded && remainingDeck && remainingDeck.length > 0) {
    const dealtCardsSet = new Set(communityCards.filter(Boolean));

    if (communityCards.length === 0 && remainingDeck.length >= 8) {
      // Pre-flop: flop is [1,2,3], turn is [5], river is [7]
      if (!dealtCardsSet.has(remainingDeck[1])) { slots[0] = remainingDeck[1]; isPreview[0] = true; }
      if (!dealtCardsSet.has(remainingDeck[2])) { slots[1] = remainingDeck[2]; isPreview[1] = true; }
      if (!dealtCardsSet.has(remainingDeck[3])) { slots[2] = remainingDeck[3]; isPreview[2] = true; }
      if (!dealtCardsSet.has(remainingDeck[5])) { slots[3] = remainingDeck[5]; isPreview[3] = true; }
      if (!dealtCardsSet.has(remainingDeck[7])) { slots[4] = remainingDeck[7]; isPreview[4] = true; }
    } else if (communityCards.length === 3) {
      // Flop dealt: check both sliced and un-sliced remainingDeck index offsets
      let turnCard = remainingDeck[1];
      let riverCard = remainingDeck[3];
      if (dealtCardsSet.has(turnCard) || dealtCardsSet.has(riverCard)) {
        turnCard = remainingDeck[5];
        riverCard = remainingDeck[7];
      }
      if (turnCard && !dealtCardsSet.has(turnCard)) { slots[3] = turnCard; isPreview[3] = true; }
      if (riverCard && !dealtCardsSet.has(riverCard)) { slots[4] = riverCard; isPreview[4] = true; }
    } else if (communityCards.length === 4) {
      // Turn dealt: check both sliced and un-sliced remainingDeck index offsets
      let riverCard = remainingDeck[1];
      if (dealtCardsSet.has(riverCard)) {
        riverCard = remainingDeck[7];
      }
      if (riverCard && !dealtCardsSet.has(riverCard)) { slots[4] = riverCard; isPreview[4] = true; }
    }
  }

  const hasAnyPreview = isPreview.some(p => p);

  return (
    <div className="flex flex-col items-center gap-3">
      {hasAnyPreview && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
          <Eye className="w-3 h-3" />
          <span>Folded Spectator View — Future Board &amp; River Unlocked</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 justify-center">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">Board</span>
        {slots.map((card, i) => {
          const isPrev = isPreview[i];
          return (
            <div
              key={i}
              className={`transition-all duration-500 relative ${
                card ? 'opacity-100 translate-y-0' : 'opacity-40'
              }`}
            >
              <CardDisplay
                card={card || undefined}
                faceDown={false}
                size="md"
                className={`${!card ? 'border-dashed border-white/15 bg-transparent' : ''} ${
                  isPrev ? 'ring-2 ring-amber-500/50 opacity-80' : ''
                }`}
              />
              {isPrev && (
                <span className="absolute -top-2 -right-1 bg-amber-500 text-amber-950 text-[8px] font-extrabold px-1 rounded shadow">
                  {i === 4 ? 'RIVER' : i === 3 ? 'TURN' : 'FLOP'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {stage && (
        <div className="flex gap-3 justify-center">
          {['PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'].map(s => (
            <div key={s} className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              s === stage ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-700'
            }`}>{s.replace('_', ' ')}</div>
          ))}
        </div>
      )}
    </div>
  );
}
