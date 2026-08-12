/**
 * Minimalist Playing Card Display Component.
 * - Bold rank number in top-left corner only
 * - Prominent suit symbol in the center
 * - card: 2-char string like 'Ah', 'Td', '2s'
 * - faceDown: show card back
 * - size: 'sm' | 'md' | 'lg'
 */

const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };

const SIZE_CONFIG = {
  sm: {
    outer: 'w-8 h-12 p-1',
    rank: 'text-[11px] font-black',
    centerSuit: 'text-2xl',
  },
  md: {
    outer: 'w-14 h-20 p-1.5',
    rank: 'text-base font-black',
    centerSuit: 'text-4xl',
  },
  lg: {
    outer: 'w-20 h-28 p-2',
    rank: 'text-xl font-black',
    centerSuit: 'text-6xl',
  },
};

export default function CardDisplay({ card, faceDown = false, size = 'md', className = '' }) {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  if (faceDown) {
    return (
      <div className={`${config.outer} rounded-xl bg-gradient-to-br from-indigo-900 via-blue-950 to-slate-950 border border-indigo-500/40 shadow-md flex items-center justify-center select-none ${className}`}>
        <div className="w-5/6 h-5/6 rounded-lg border border-indigo-400/30 bg-indigo-900/40 flex items-center justify-center shadow-inner">
          <span className="text-amber-400/80 text-[10px] font-black tracking-widest">★</span>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className={`${config.outer} rounded-xl border-2 border-dashed border-white/10 ${className}`} />
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const displayRank = rank === 'T' ? '10' : rank;
  const isRed = suit === 'h' || suit === 'd';

  return (
    <div
      className={`${config.outer} rounded-xl bg-white border border-zinc-200/90 shadow-md flex flex-col justify-between relative select-none overflow-hidden ${
        isRed ? 'text-red-600' : 'text-zinc-950'
      } ${className}`}
    >
      {/* Top-Left Corner: Rank Number Only */}
      <div className="self-start leading-none z-10">
        <span className={`${config.rank} tracking-tighter leading-none`}>{displayRank}</span>
      </div>

      {/* Prominent Center Suit Feature */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <span className={`${config.centerSuit} leading-none select-none filter drop-shadow-sm`}>
          {SUIT_SYMBOLS[suit]}
        </span>
      </div>
    </div>
  );
}
