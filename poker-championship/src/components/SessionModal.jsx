import { X, Check } from 'lucide-react';
import { getSystemStateAtDay } from '../utils/pokerEngine';


export default function SessionModal({
  isOpen,
  onClose,
  sessionDay,
  setSessionDay,
  sessionDraft,
  handleSessionDraftChange,
  saveSession,
  config,
  sessions
}) {
  if (!isOpen) return null;

  const draftState = getSystemStateAtDay(Number(sessionDay) || 0, config);
  const expectedCirculation = draftState.amountInCirculation; 
  const draftTotal  = Object.values(sessionDraft).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const circulationDiff = draftTotal - expectedCirculation;
  const isTargetDayPayday = Number(sessionDay) > 0 && Number(sessionDay) % config.paydayInterval === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
      <div className="bg-[#09090b] sm:bg-zinc-900/90 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
          <div>
            <h3 className="text-lg font-bold text-white">Record Chips</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isTargetDayPayday ? (
                <span className="text-emerald-400 font-medium">Payday distributed automatically.</span>
              ) : (
                "Update end-of-day balances."
              )}
            </p>
          </div>
          <button onClick={onClose} className="bg-white/10 text-zinc-300 hover:text-white p-2 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Day</label>
              <input
                type="number"
                value={sessionDay}
                onChange={e => setSessionDay(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-white font-bold text-lg focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex-1 flex flex-col justify-end">
              <div className={`p-3 rounded-xl border flex flex-col justify-center h-[56px] ${circulationDiff === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                <span className="text-[10px] font-bold uppercase text-zinc-500">Diff</span>
                <span className={`font-mono font-bold text-sm ${circulationDiff === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {circulationDiff > 0 ? '+' : ''}{circulationDiff} {circulationDiff !== 0 && '(!)'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {config.players.map(p => {
              const currentBal = Number(sessionDraft[p.id] || 0);
              const isEdited = currentBal !== (sessions[0]?.balances?.[p.id] ?? Number(p.startBalance));

              return (
                <div key={p.id} className="relative group">
                  <label className="absolute top-2 left-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    {p.name} {isEdited && <span className="text-emerald-400">*</span>}
                  </label>
                  <input
                    type="number"
                    value={sessionDraft[p.id] === 0 ? '' : sessionDraft[p.id]}
                    placeholder="0"
                    onChange={e => handleSessionDraftChange(p.id, e.target.value)}
                    className={`w-full bg-zinc-950 border rounded-xl p-3 pt-6 pb-2 text-white font-mono text-lg focus:outline-none transition-colors ${
                      isEdited ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 border-t border-white/5 bg-[#09090b] sm:rounded-b-3xl pb-8 sm:pb-5">
          <button onClick={saveSession} className="w-full py-4 rounded-xl font-bold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors flex justify-center items-center gap-2">
            <Check className="h-5 w-5" /> Save Day {sessionDay} Balances
          </button>
        </div>

      </div>
    </div>
  );
}
