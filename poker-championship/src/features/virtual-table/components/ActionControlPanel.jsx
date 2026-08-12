import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export default function ActionControlPanel({
  actingPlayer,
  minRaiseTo,
  totalLivePot,
  handleAction,
  liveGame,
  isMyTurn = false,
  isAuthenticated = false,
  layout = 'horizontal',
}) {
  const [raiseValue, setRaiseValue] = useState(minRaiseTo);
  const [prevMinRaiseTo, setPrevMinRaiseTo] = useState(minRaiseTo);

  // Sync raiseValue when minRaiseTo changes (e.g. new hand / new acting player)
  if (minRaiseTo !== prevMinRaiseTo) {
    setPrevMinRaiseTo(minRaiseTo);
    setRaiseValue(minRaiseTo);
  }

  const maxAllIn = Number(actingPlayer?.stack || 0) + Number(actingPlayer?.currentBet || 0);
  const bigBlind = Number(liveGame?.bigBlind || 50);

  const handleAddChip = (amount) => {
    const current = Number(raiseValue || 0);
    setRaiseValue(Math.min(current + amount, maxAllIn));
  };

  const handleStep = (direction) => {
    const current = Number(raiseValue || minRaiseTo);
    const step = bigBlind;
    if (direction === 'down') {
      setRaiseValue(Math.max(minRaiseTo, current - step));
    } else {
      setRaiseValue(Math.min(maxAllIn, current + step));
    }
  };

  const isCallDisabled = Number(actingPlayer?.currentBet || 0) >= Number(liveGame?.highestBet || 0);
  const isCheckDisabled = Number(actingPlayer?.currentBet || 0) < Number(liveGame?.highestBet || 0);
  const callAmount = Number(liveGame?.highestBet || 0) - Number(actingPlayer?.currentBet || 0);

  // Determine player blind/seat role
  let roleLabel = 'Active Hand';
  if (liveGame?.players && actingPlayer) {
    const idx = liveGame.players.findIndex(p => p.id === actingPlayer.id);
    const activeCount = liveGame.players.filter(lp => !lp.outOfChips).length;
    const activeIdxs = [];
    for (let i = 1; i <= liveGame.players.length; i++) {
      const checkIdx = (liveGame.dealerIndex + i) % liveGame.players.length;
      if (!liveGame.players[checkIdx]?.outOfChips) activeIdxs.push(checkIdx);
    }
    if (idx === liveGame.dealerIndex) roleLabel = 'Dealer';
    else if (activeCount === 2 && idx === activeIdxs[0]) roleLabel = 'Small Blind';
    else if (activeCount > 2 && idx === activeIdxs[0]) roleLabel = 'Small Blind';
    else if (activeCount > 2 && idx === activeIdxs[1]) roleLabel = 'Big Blind';
  }

  const canInteract = isMyTurn || isAuthenticated;

  // ── Horizontal Layout ───────────────────────────────────────────────────
  if (layout === 'horizontal') {
    return (
      <div className={`w-full max-w-full min-w-0 transition-all duration-300 ${!canInteract ? 'opacity-50 pointer-events-none select-none' : 'opacity-100'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch w-full max-w-full min-w-0">
          
          {/* ZONE 1: Turn & Player Status */}
          <div className="lg:col-span-3 min-w-0 bg-zinc-950/60 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
              <span>
                {isMyTurn ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                    Your Turn
                  </span>
                ) : (
                  'Waiting on Turn'
                )}
              </span>
              <span className="text-[10px] font-mono text-amber-400/90 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                {roleLabel}
              </span>
            </div>

            <div className="py-0.5 min-w-0">
              <h4
                className="text-base sm:text-lg font-black text-amber-400 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full"
                title={actingPlayer?.name}
              >
                {actingPlayer?.name || 'Player'}
              </h4>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-300 font-mono font-bold border-t border-white/5 pt-1.5 min-w-0">
              <span>Stack: <strong className="text-white">{Number(actingPlayer?.stack || 0).toLocaleString()}</strong></span>
              <span>Bet: <strong className="text-zinc-200">{Number(actingPlayer?.currentBet || 0).toLocaleString()}</strong></span>
            </div>
          </div>

          {/* ZONE 2: Primary Decision Actions */}
          <div className="lg:col-span-4 min-w-0 bg-zinc-950/60 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between space-y-2">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 flex justify-between items-center">
              <span>Primary Decision</span>
              {callAmount > 0 && !isCallDisabled && (
                <span className="text-emerald-400 font-mono font-bold text-[10px]">
                  To Call: {callAmount.toLocaleString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleAction('FOLD')}
                className="bg-zinc-900 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 font-extrabold rounded-xl py-2.5 px-2 text-xs transition-all cursor-pointer active:scale-95 shadow-sm flex items-center justify-center"
              >
                Fold
              </button>

              <button
                type="button"
                onClick={() => handleAction('CHECK')}
                disabled={isCheckDisabled}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 hover:border-white/20 font-extrabold rounded-xl py-2.5 px-2 text-xs transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm flex items-center justify-center"
              >
                Check
              </button>

              <button
                type="button"
                onClick={() => handleAction('CALL')}
                disabled={isCallDisabled}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black border border-emerald-400/40 rounded-xl py-2 px-2 text-xs transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-md flex flex-col items-center justify-center"
              >
                <span className="leading-none">Call</span>
                {!isCallDisabled && callAmount > 0 && (
                  <span className="text-[10px] font-mono font-extrabold text-emerald-950/80 mt-0.5">
                    ({callAmount.toLocaleString()})
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ZONE 3: Bet Sizing & Raise Controls */}
          <div className="lg:col-span-5 min-w-0 w-full max-w-full bg-zinc-950/60 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between gap-2 w-full min-w-0">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 shrink-0">
                  Raise To
                </span>

                <button
                  type="button"
                  onClick={() => handleStep('down')}
                  disabled={Number(raiseValue || 0) <= minRaiseTo}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-90 shrink-0"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <input
                  type="number"
                  placeholder={`${minRaiseTo}`}
                  value={raiseValue}
                  onChange={e => setRaiseValue(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-zinc-900 border border-white/10 rounded-lg py-1 px-2 text-right text-xs text-zinc-200 font-mono font-bold w-16 sm:w-20 focus:outline-none focus:border-amber-500/50 flex-1 min-w-[45px]"
                />

                <button
                  type="button"
                  onClick={() => handleStep('up')}
                  disabled={Number(raiseValue || 0) >= maxAllIn}
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-90 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleAction('RAISE', raiseValue)}
                disabled={!raiseValue || Number(raiseValue) < minRaiseTo || Number(raiseValue) > maxAllIn}
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-black py-1.5 px-3.5 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0 active:scale-95"
              >
                Raise
              </button>
            </div>

            <div className="w-full min-w-0">
              <input
                type="range"
                min={minRaiseTo}
                max={maxAllIn}
                step={bigBlind}
                value={Number(raiseValue || minRaiseTo)}
                onChange={e => setRaiseValue(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <div className="w-full min-w-0 pt-1.5 border-t border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1 flex-wrap">
                  {[10, 50, 100, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleAddChip(amt)}
                      className="h-7 px-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-amber-500/40 text-zinc-200 hover:text-amber-400 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 flex-wrap font-mono">
                  <button
                    type="button"
                    onClick={() => setRaiseValue(minRaiseTo)}
                    className="h-7 px-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                  >
                    MIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setRaiseValue(Math.max(minRaiseTo, totalLivePot))}
                    className="h-7 px-2 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                  >
                    POT
                  </button>
                  <button
                    type="button"
                    onClick={() => setRaiseValue(maxAllIn)}
                    className="h-7 px-2.5 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 font-black text-[10px] rounded-lg transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                  >
                    ALL IN
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // ── Vertical Layout (Host Sidebar) ──────────────────────────────────────
  return (
    <div className={`space-y-4 ${!canInteract ? 'opacity-50 pointer-events-none select-none' : 'opacity-100'}`}>
      {/* Active player info */}
      <div className="bg-zinc-950/40 p-4 rounded-2xl border border-white/5 space-y-2">
        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
          <span>Waiting on Turn</span>
          <span className="text-amber-400/90 font-bold">{roleLabel}</span>
        </div>
        <h4 className="text-lg font-black text-amber-400">{actingPlayer?.name || 'Player'}</h4>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs text-zinc-400 font-mono">
          <span>Stack: <strong className="text-zinc-200">{Number(actingPlayer?.stack || 0).toLocaleString()}</strong></span>
          <span>Bet: <strong className="text-zinc-200">{Number(actingPlayer?.currentBet || 0).toLocaleString()}</strong></span>
        </div>
      </div>

      {/* Fold / Check / Call */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleAction('FOLD')}
          className="bg-zinc-900 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 font-extrabold py-3 px-2 rounded-xl text-sm transition-all cursor-pointer"
        >Fold</button>
        <button
          type="button"
          onClick={() => handleAction('CHECK')}
          disabled={isCheckDisabled}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 font-extrabold py-3 px-2 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >Check</button>
        <button
          type="button"
          onClick={() => handleAction('CALL')}
          disabled={isCallDisabled}
          className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black border border-emerald-400/40 py-3 px-2 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center"
        >
          <span className="leading-none">Call</span>
          {!isCallDisabled && callAmount > 0 && (
            <span className="text-[9px] font-mono mt-0.5 opacity-90">({callAmount.toLocaleString()})</span>
          )}
        </button>
      </div>

      {/* Raise section */}
      <div className="pt-2 border-t border-white/5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-400 font-semibold">Raise to:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStep('down')}
              disabled={Number(raiseValue || 0) <= minRaiseTo}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-90"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="number"
              placeholder={`Min: ${minRaiseTo}`}
              value={raiseValue}
              onChange={e => setRaiseValue(e.target.value === '' ? '' : Number(e.target.value))}
              className="bg-zinc-950 border border-white/10 rounded-xl py-1.5 px-2.5 text-right text-sm text-zinc-200 font-mono font-semibold w-24 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={() => handleStep('up')}
              disabled={Number(raiseValue || 0) >= maxAllIn}
              className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none active:scale-90"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <input
          type="range"
          min={minRaiseTo}
          max={maxAllIn}
          step={bigBlind}
          value={Number(raiseValue || minRaiseTo)}
          onChange={e => setRaiseValue(Number(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        <div className="flex items-center justify-between gap-1 bg-zinc-950/40 p-2 rounded-2xl border border-white/5 overflow-x-auto">
          {[10, 50, 100, 500].map(amt => (
            <button
              key={amt}
              type="button"
              onClick={() => handleAddChip(amt)}
              className="h-8 px-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-extrabold text-[10px] rounded-lg transition-all active:scale-90 cursor-pointer"
            >+{amt}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold font-mono">
          <button onClick={() => setRaiseValue(minRaiseTo)} className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 py-1.5 rounded-lg transition-colors">MIN</button>
          <button onClick={() => setRaiseValue(Math.max(minRaiseTo, totalLivePot))} className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 py-1.5 rounded-lg transition-colors">POT</button>
          <button onClick={() => setRaiseValue(maxAllIn)} className="bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 font-extrabold py-1.5 rounded-lg transition-colors">ALL IN</button>
        </div>

        <button
          onClick={() => handleAction('RAISE', raiseValue)}
          disabled={!raiseValue || Number(raiseValue) < minRaiseTo || Number(raiseValue) > maxAllIn}
          className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-black py-2.5 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
        >Submit Raise</button>
      </div>
    </div>
  );
}
