import { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertTriangle, Coins, Sparkles, Loader2 } from 'lucide-react';

export default function AuditModal({
  isOpen,
  onClose,
  activeSession,
  config,
  sessions,
  onCommit,
  playerDeclarations,
  balances = {}
}) {
  const [ledgerDraft, setLedgerDraft] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize draft when modal opens
  useEffect(() => {
    if (!isOpen || !activeSession) return;

    const initialDraft = {};
    config.players.forEach(p => {
      const declaration = playerDeclarations?.[p.id];
      if (declaration) {
        initialDraft[p.id] = {
          played: true,
          buyIn: Number(declaration.buyIn || 0),
          rebuys: Number(declaration.rebuys || 0),
          cashOut: Number(declaration.cashOut || 0),
          status: declaration.status || 'active'
        };
      } else {
        // Player did not log joining, but Admin can manually add them
        initialDraft[p.id] = {
          played: false,
          buyIn: 0,
          rebuys: 0,
          cashOut: 0,
          status: 'did_not_play'
        };
      }
    });

    setLedgerDraft(initialDraft);
    setError('');
  }, [isOpen, activeSession, config.players]);

  // Handle value change
  const handleChange = (playerId, field, value) => {
    setLedgerDraft(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: value === '' ? 0 : Number(value)
      }
    }));
  };

  const handleTogglePlayed = (playerId) => {
    setLedgerDraft(prev => {
      const isCurrentlyPlaying = prev[playerId].played;
      return {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          played: !isCurrentlyPlaying,
          status: !isCurrentlyPlaying ? 'active' : 'did_not_play',
          buyIn: !isCurrentlyPlaying ? (() => {
            const val = balances[playerId];
            if (val !== undefined && val !== null) {
              return typeof val === 'object' ? Number(val.bank || 0) : Number(val);
            }
            return Number(config.players.find(p => p.id === playerId)?.startBalance || 0);
          })() : 0,
          rebuys: 0,
          cashOut: 0
        }
      };
    });
  };

  // Math derivations
  const auditSummary = useMemo(() => {
    let totalBuyIns = 0;
    let totalCashOuts = 0;
    let playersActiveCount = 0;
    let missingCashOutsCount = 0;

    Object.entries(ledgerDraft).forEach(([pid, data]) => {
      if (data.played) {
        totalBuyIns += (data.buyIn + data.rebuys);
        totalCashOuts += data.cashOut;
        playersActiveCount++;
        if (data.status === 'active' && data.cashOut === 0) {
          // If status is active and cashOut is 0, they might have forgotten to cash out
          missingCashOutsCount++;
        }
      }
    });

    const discrepancy = totalCashOuts - totalBuyIns;

    return {
      totalBuyIns,
      totalCashOuts,
      discrepancy,
      playersActiveCount,
      missingCashOutsCount
    };
  }, [ledgerDraft]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Check if any active player has cashOut === 0 and was not audited
    const missingCashOutPlayers = Object.entries(ledgerDraft)
      .filter(([_, data]) => data.played && data.status === 'active' && data.cashOut === 0)
      .map(([pid]) => config.players.find(p => p.id === pid)?.name || pid);

    if (missingCashOutPlayers.length > 0) {
      if (!window.confirm(`Warning: The following players are active but have 0 cash-out: ${missingCashOutPlayers.join(', ')}. Proceed anyway?`)) {
        setIsLoading(false);
        return;
      }
    }

    try {
      await onCommit(ledgerDraft);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to commit ledger changes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !activeSession) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-2.5 rounded-xl shadow-lg">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Audit & End Day {activeSession.dayNumber}</h2>
              <p className="text-xs text-zinc-500">Verify declarations before committing scores to lifetime statistics.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Audit Discrepancy Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 bg-zinc-950/60 border border-white/5 rounded-xl text-xs">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 uppercase font-bold tracking-wider text-[10px]">Buy-Ins:</span>
                <span className="font-mono font-bold text-zinc-200">{auditSummary.totalBuyIns.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 uppercase font-bold tracking-wider text-[10px]">Cash-Outs:</span>
                <span className="font-mono font-bold text-zinc-200">{auditSummary.totalCashOuts.toLocaleString()}</span>
              </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all w-full sm:w-auto justify-between sm:justify-start ${
              auditSummary.discrepancy === 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <span className="uppercase font-bold tracking-wider text-[10px] opacity-80">Discrepancy:</span>
              <div className="flex items-center gap-1 font-mono font-black">
                {auditSummary.discrepancy === 0 ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>0</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{auditSummary.discrepancy > 0 ? `+${auditSummary.discrepancy}` : auditSummary.discrepancy}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Player Ledger Sheet */}
          <div className="border border-white/5 rounded-2xl bg-zinc-950/40 p-2">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 z-10">Player</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-center z-10">Status</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Buy-In</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Rebuys</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Cash-Out</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {config.players.map(p => {
                  const data = ledgerDraft[p.id];
                  if (!data) return null;

                  const profit = data.played ? data.cashOut - (data.buyIn + data.rebuys) : 0;
                  
                  return (
                    <tr key={p.id} className={`transition-colors ${data.played ? 'bg-transparent' : 'opacity-40 hover:opacity-60'}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={data.played}
                            onChange={() => handleTogglePlayed(p.id)}
                            className="w-4 h-4 rounded border-white/10 bg-zinc-950 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-zinc-200">{p.name}</span>
                            <span className="block text-[9px] text-zinc-500 font-bold font-mono">ID: {p.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        {data.played ? (
                          data.status === 'cashed_out' ? (
                            <span className="inline-flex bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Cashed Out</span>
                          ) : (
                            <span className="inline-flex bg-rose-500/10 text-rose-400 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded animate-pulse">Forgot Cash-Out</span>
                          )
                        ) : (
                          <span className="inline-flex bg-zinc-800 text-zinc-500 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Did Not Play</span>
                        )}
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          disabled={!data.played}
                          value={data.buyIn}
                          onChange={(e) => handleChange(p.id, 'buyIn', e.target.value)}
                          className="w-20 bg-zinc-950 border border-white/5 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg p-1.5 text-right font-mono text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          disabled={!data.played}
                          value={data.rebuys}
                          onChange={(e) => handleChange(p.id, 'rebuys', e.target.value)}
                          className="w-20 bg-zinc-950 border border-white/5 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg p-1.5 text-right font-mono text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          disabled={!data.played}
                          value={data.cashOut}
                          onChange={(e) => handleChange(p.id, 'cashOut', e.target.value)}
                          className={`w-24 bg-zinc-950 border disabled:opacity-20 disabled:cursor-not-allowed rounded-lg p-1.5 text-right font-mono text-xs text-white focus:outline-none ${
                            data.played && data.status === 'active' && data.cashOut === 0
                              ? 'border-rose-500/40 focus:border-rose-500'
                              : 'border-white/5 focus:border-emerald-500'
                          }`}
                        />
                      </td>

                      <td className="p-3 text-right">
                        {data.played ? (
                          <span className={`font-mono font-bold ${profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                            {profit > 0 ? `+${profit.toLocaleString()}` : profit.toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-mono text-zinc-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="px-5">
            <p className="text-rose-400 text-xs font-semibold text-center mb-4">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center border-t border-white/5 p-5 bg-[#09090b]">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Approve & Commit calculates all final balances and paydays.</span>
          </div>

          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/5 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-amber-950 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>Committing... <Loader2 className="w-4 h-4 animate-spin" /></>
              ) : (
                <>Approve & Commit<span className="hidden sm:inline"> Day</span></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
