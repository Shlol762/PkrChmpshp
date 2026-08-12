import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';
import { Trophy, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { evaluateShowdown } from '../../../utils/handEvaluator';

export default function ShowdownPanel({
  liveGame,
  activeTableId,
  totalLivePot,
  selectedWinners,
  winnerPayouts,
  handleWinnerToggle,
  handlePayoutChange,
  handleAwardShowdown,
}) {
  const [holeCardsMap, setHoleCardsMap] = useState({});
  const [evalResult, setEvalResult] = useState(null);

  // Fetch hole cards for Mode C to auto-evaluate hands
  useEffect(() => {
    if (!activeTableId || liveGame?.mode !== 'full_digital') return;
    const ref = doc(db, 'artifacts', safeAppId, 'public', 'data', 'holeCards', activeTableId);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setHoleCardsMap(snap.data());
    });
    return () => unsub();
  }, [activeTableId, liveGame?.mode]);

  // Evaluate hands when showdown opens or hole cards load
  useEffect(() => {
    if (!liveGame || liveGame.stage !== 'SHOWDOWN' || Object.keys(holeCardsMap).length === 0) return;
    const res = evaluateShowdown(liveGame.players, holeCardsMap, liveGame.communityCards || []);
    setEvalResult(res);

    // Auto-select winners and auto-distribute pot if not already manually modified
    if (res.winningPlayerIds.length > 0 && selectedWinners.length === 0) {
      res.winningPlayerIds.forEach(id => handleWinnerToggle(id));
      const share = Math.floor(totalLivePot / res.winningPlayerIds.length);
      const remainder = totalLivePot % res.winningPlayerIds.length;
      res.winningPlayerIds.forEach((id, idx) => {
        const amt = share + (idx === 0 ? remainder : 0);
        handlePayoutChange(id, amt);
      });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveGame?.stage, holeCardsMap, totalLivePot]);

  const payoutSum = Object.values(winnerPayouts).reduce((s, v) => s + Number(v || 0), 0);
  const sumOk = payoutSum === totalLivePot;

  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-4">
      <h3 className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 border-b border-white/5 pb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" /> Showdown &amp; Hand Evaluation
        </span>
        {liveGame?.mode === 'full_digital' && (
          <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Auto-Evaluated
          </span>
        )}
      </h3>

      {/* Evaluated hand rankings */}
      {evalResult && evalResult.evaluations.length > 0 && (
        <div className="space-y-2 bg-zinc-950/60 p-3.5 rounded-2xl border border-white/5">
          <label className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">
            Hand Rankings (Best to Worst)
          </label>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {evalResult.evaluations.map(ev => (
              <div
                key={ev.playerId}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  ev.isWinner
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold'
                    : 'bg-zinc-900/40 border-white/5 text-zinc-400 font-medium'
                }`}
              >
                <div className="flex items-center gap-2">
                  {ev.isWinner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="text-white">{ev.name}</span>
                </div>
                <span className="text-amber-400/90 text-right">{ev.handName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Select Winner(s)</label>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {liveGame.players.filter(p => !p.folded).map(p => {
            const isChecked = selectedWinners.includes(p.id);
            const ev = evalResult?.evaluations?.find(e => e.playerId === p.id);
            return (
              <button
                key={p.id}
                onClick={() => handleWinnerToggle(p.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${
                  isChecked ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isChecked ? 'bg-amber-500 border-amber-500 text-amber-950' : 'border-zinc-700'
                  }`}>
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span>{p.name}</span>
                </div>
                {ev && <span className="text-[11px] font-medium text-amber-400/80">{ev.handName}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selectedWinners.length > 0 && (
        <div className="pt-2 border-t border-white/5 space-y-3">
          <div className="flex justify-between items-center text-xs text-zinc-400 mb-1">
            <span>Distribute Pot:</span>
            <span className="font-mono text-zinc-200 font-bold">{totalLivePot.toLocaleString()} chips</span>
          </div>
          <div className="space-y-2 bg-zinc-950/30 p-3.5 rounded-2xl border border-white/5 max-h-48 overflow-y-auto">
            {selectedWinners.map(winnerId => {
              const name = liveGame.players.find(p => p.id === winnerId)?.name || winnerId;
              return (
                <div key={winnerId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300 font-medium">{name}</span>
                  <input
                    type="number"
                    value={winnerPayouts[winnerId] ?? 0}
                    onChange={e => handlePayoutChange(winnerId, e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-xl py-1 px-3 text-right text-sm text-zinc-200 font-mono font-semibold w-24 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              );
            })}
          </div>

          {!sumOk && (
            <div className="text-[10px] text-rose-400 flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Payout sum ({payoutSum.toLocaleString()}) must match pot!</span>
            </div>
          )}

          <button
            onClick={handleAwardShowdown}
            disabled={!sumOk}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-3 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >Confirm &amp; Start Next Hand</button>
        </div>
      )}
    </div>
  );
}
