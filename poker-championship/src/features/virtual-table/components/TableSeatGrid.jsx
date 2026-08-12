import { Coins, Pencil, Check, AlertTriangle, Eye } from 'lucide-react';
import HoleCards from './HoleCards';

export default function TableSeatGrid({
  liveGame,
  isAuthenticated,
  isSpectator,
  repositionMode,
  editingStack,
  setEditingStack,
  handleSeatCardClick,
  handleSaveStackEdit,
  currentPlayerId,
  activeTableId,
}) {
  const isRepoClickable = isAuthenticated && repositionMode !== null;

  // Check if current viewing user has folded or is spectating
  const myPlayer = liveGame?.players?.find(p => p.id === currentPlayerId);
  const isViewerFolded = isAuthenticated || isSpectator || !currentPlayerId || myPlayer?.folded === true;

  // Compute blind positions
  const activePlayerIdxs = [];
  for (let i = 1; i <= liveGame.players.length; i++) {
    const checkIdx = (liveGame.dealerIndex + i) % liveGame.players.length;
    if (!liveGame.players[checkIdx].outOfChips) activePlayerIdxs.push(checkIdx);
  }
  const activeCount = liveGame.players.filter(p => !p.outOfChips).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10">
      {liveGame.players.map((p, idx) => {
        const isDealer = idx === liveGame.dealerIndex;
        const isActing = idx === liveGame.actingPlayerIndex;

        let blindLabel = '';
        if (activeCount === 2) {
          if (idx === liveGame.dealerIndex) blindLabel = 'SB';
          else if (idx === activePlayerIdxs[0]) blindLabel = 'BB';
        } else if (activeCount > 2) {
          if (idx === activePlayerIdxs[0]) blindLabel = 'SB';
          else if (idx === activePlayerIdxs[1]) blindLabel = 'BB';
        }

        let cardClass = 'bg-zinc-900/50 border-white/5';
        if (p.folded) cardClass = 'bg-zinc-950/30 border-white/5 opacity-75';
        else if (p.isAllIn) cardClass = 'bg-rose-500/5 border-rose-500/20';
        else if (isActing && liveGame.stage !== 'SHOWDOWN') cardClass = 'bg-zinc-900 border-amber-500/60 ring-2 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]';

        return (
          <div
            key={p.id}
            className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative ${cardClass} ${
              isRepoClickable ? 'cursor-pointer ring-2 ring-amber-500/40 hover:ring-amber-400/70' : ''
            }`}
            onClick={() => isRepoClickable && handleSeatCardClick(idx)}
          >
            {/* Badge header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400">
                Seat {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                {isDealer && (
                  <span className="w-5 h-5 rounded-full bg-white text-zinc-950 font-bold text-[9px] flex items-center justify-center border border-zinc-200 shadow-md" title="Dealer Button">D</span>
                )}
                {blindLabel && !p.folded && (
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                    blindLabel === 'BB' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                  }`}>{blindLabel}</span>
                )}
                {isAuthenticated && !repositionMode && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingStack({ idx, value: String(p.stack) }); }}
                    title="Edit stack"
                    className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Pencil className="w-2.5 h-2.5 text-zinc-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Name & stack */}
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <h4 className={`text-base font-bold truncate ${
                  isActing && liveGame.stage !== 'SHOWDOWN' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                }`}>{p.name}</h4>
                {p.folded && (
                  <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Folded
                  </span>
                )}
              </div>

              {editingStack?.idx === idx ? (
                <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                  <input
                    type="number" autoFocus
                    value={editingStack.value}
                    onChange={e => setEditingStack(prev => ({ ...prev, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveStackEdit(); if (e.key === 'Escape') setEditingStack(null); }}
                    className="bg-zinc-950 border border-amber-500/50 rounded-lg py-1 px-2 text-right text-xs text-zinc-200 font-mono font-semibold w-20 focus:outline-none"
                  />
                  <button onClick={handleSaveStackEdit} className="text-emerald-400 hover:text-emerald-300 cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingStack(null)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer"><AlertTriangle className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 font-semibold tracking-wide">
                  Stack: <span className="font-mono text-zinc-300 font-extrabold">{Number(p.stack).toLocaleString()}</span>
                </p>
              )}

              {/* Hole cards (Mode C) */}
              {liveGame.mode === 'full_digital' && (
                <div className="mt-2">
                  <HoleCards
                    activeTableId={activeTableId}
                    currentPlayerId={currentPlayerId}
                    isAuthenticated={isAuthenticated}
                    isSpectator={isSpectator}
                    isViewerFolded={isViewerFolded}
                    playerId={p.id}
                    handNumber={liveGame.handNumber}
                  />
                </div>
              )}
            </div>

            {/* Bet / status */}
            <div className="mt-2 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs min-h-[30px]">
              {p.folded ? (
                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
                  {isViewerFolded && <Eye className="w-3 h-3 text-amber-400" />} Folded
                </span>
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
  );
}
