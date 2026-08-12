import { Undo2, SkipForward, Target, ChevronDown, ChevronUp } from 'lucide-react';

export default function HostOverrides({
  liveGame,
  repositionMode, setRepositionMode,
  undoCount,
  handleUndo, handleSkipTurn,
  showManualPanel, setShowManualPanel,
  manualAdjustPlayer, setManualAdjustPlayer,
  manualAdjustAmount, setManualAdjustAmount,
  manualAdjustReason, setManualAdjustReason,
  handleManualAdjustment,
}) {
  const MAX_HISTORY = 5;
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-3">
      <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5 flex items-center gap-2">
        <Target className="w-3.5 h-3.5" /> Host Overrides
      </h3>

      {/* Undo + Skip */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleUndo}
          disabled={undoCount === 0}
          title={`Undo (${undoCount}/${MAX_HISTORY} saved)`}
          className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo ({undoCount})
        </button>
        <button
          onClick={handleSkipTurn}
          disabled={liveGame?.actingPlayerIndex === -1}
          className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip Turn
        </button>
      </div>

      {/* Reposition */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setRepositionMode(repositionMode === 'dealer' ? null : 'dealer')}
          className={`flex items-center justify-center gap-1.5 font-bold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer border ${
            repositionMode === 'dealer' ? 'bg-white text-zinc-950 border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]' : 'bg-zinc-800 hover:bg-zinc-700 border-white/5 text-zinc-300'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white text-zinc-950 font-black text-[9px] flex items-center justify-center shrink-0">D</span>
          Set Dealer
        </button>
        <button
          onClick={() => setRepositionMode(repositionMode === 'acting' ? null : 'acting')}
          className={`flex items-center justify-center gap-1.5 font-bold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer border ${
            repositionMode === 'acting' ? 'bg-amber-500 text-amber-950 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]' : 'bg-zinc-800 hover:bg-zinc-700 border-white/5 text-zinc-300'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-amber-500 text-amber-950 font-black text-[9px] flex items-center justify-center shrink-0">▶</span>
          Set Turn
        </button>
      </div>

      {/* Manual stack adjustment */}
      <button
        onClick={() => setShowManualPanel(!showManualPanel)}
        className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-widest cursor-pointer hover:text-zinc-300 pt-1 border-t border-white/5"
      >
        <span>Stack Adjustment (±)</span>
        {showManualPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showManualPanel && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div>
            <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Player</label>
            <select value={manualAdjustPlayer} onChange={e => setManualAdjustPlayer(e.target.value)}
              className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-300 text-xs font-semibold w-full focus:outline-none">
              <option value="">Select Player</option>
              {liveGame.players.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.stack.toLocaleString()})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Add/Sub Chips</label>
              <input type="number" placeholder="e.g. 5000 or -200"
                value={manualAdjustAmount}
                onChange={e => setManualAdjustAmount(e.target.value)}
                className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-200 font-mono text-xs w-full focus:outline-none" />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Reason</label>
              <select value={manualAdjustReason} onChange={e => setManualAdjustReason(e.target.value)}
                className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-300 text-xs w-full focus:outline-none">
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
          >Apply Adjustment</button>
        </div>
      )}
    </div>
  );
}
