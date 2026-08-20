import { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertTriangle, Coins, Sparkles, Loader2 } from 'lucide-react';
import { calculatePaydays } from '../utils/pokerEngine';

export default function SessionModal({
  isOpen,
  onClose,
  sessionDay,
  setSessionDay,
  editingSessionId,
  saveSession,
  config,
  sessions,
  loans,
  balances = {}
}) {
  const [ledgerDraft, setLedgerDraft] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Find editing session if applicable
  const editingSession = useMemo(() => {
    if (!editingSessionId) return null;
    return sessions.find(s => s.id === editingSessionId);
  }, [editingSessionId, sessions]);

  // Helper to get previous balance (before the session being edited or created)
  const getPreviousBalance = (playerId) => {
    const prevSession = sessions
      .filter(s => s.id !== editingSessionId && s.status !== 'active')
      .sort((a, b) => Number(b.dayNumber) - Number(a.dayNumber))
      .find(s => Number(s.dayNumber) < Number(sessionDay));
      
    if (prevSession) {
      const val = prevSession.balances?.[playerId];
      return typeof val === 'object' && val !== null ? Number(val.bank || 0) + Number(val.wallet || 0) : Number(val || 0);
    }
    const p = config.players.find(p => p.id === playerId);
    return config.currentRound === 2 ? Number(p?.r2StartBalance ?? 8300) : Number(p?.startBalance || 0);
  };

  // Initialize draft when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initialDraft = {};
    const prevSession = sessions
      .filter(s => s.id !== editingSessionId && s.status !== 'active')
      .sort((a, b) => Number(b.dayNumber) - Number(a.dayNumber))
      .find(s => Number(s.dayNumber) < Number(sessionDay));

    config.players.forEach(p => {
      if (editingSession) {
        const ledgerRecord = editingSession.ledger?.[p.id];
        if (ledgerRecord) {
          initialDraft[p.id] = {
            played: !!ledgerRecord.played || (ledgerRecord.buyIn > 0 || ledgerRecord.rebuys > 0 || ledgerRecord.cashOut > 0),
            buyIn: Number(ledgerRecord.buyIn || 0),
            rebuys: Number(ledgerRecord.rebuys || 0),
            cashOut: Number(ledgerRecord.cashOut || 0),
            status: ledgerRecord.status || 'cashed_out'
          };
        } else {
          // Fallback reconstruction for older session files
          const currentBal = editingSession.balances?.[p.id];
          const prevBal = prevSession?.balances?.[p.id];
          
          const currentTotal = typeof currentBal === 'object' 
            ? Number(currentBal.bank || 0) + Number(currentBal.wallet || 0)
            : Number((currentBal ?? p.startBalance) || 0);

          const prevTotal = typeof prevBal === 'object'
            ? Number(prevBal.bank || 0) + Number(prevBal.wallet || 0)
            : Number((prevBal ?? p.startBalance) || 0);

          const payday = Number(editingSession.paydaysDistributed?.[p.id] || 0);
          const truePokerDiff = currentTotal - prevTotal - payday;

          if (truePokerDiff !== 0) {
            initialDraft[p.id] = {
              played: true,
              buyIn: truePokerDiff < 0 ? -truePokerDiff : 0,
              rebuys: 0,
              cashOut: truePokerDiff > 0 ? truePokerDiff : 0,
              status: 'cashed_out'
            };
          } else {
            initialDraft[p.id] = {
              played: false,
              buyIn: 0,
              rebuys: 0,
              cashOut: 0,
              status: 'did_not_play'
            };
          }
        }
      } else {
        // Manual entry of a new session
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
  }, [isOpen, editingSession, config.players, sessionDay]);

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
      const isCurrentlyPlaying = prev[playerId]?.played;
      return {
        ...prev,
        [playerId]: {
          ...prev[playerId],
          played: !isCurrentlyPlaying,
          status: !isCurrentlyPlaying ? 'cashed_out' : 'did_not_play',
          buyIn: !isCurrentlyPlaying ? (() => {
            const val = getPreviousBalance(playerId);
            return Number(val);
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

    Object.entries(ledgerDraft).forEach(([pid, data]) => {
      if (data.played) {
        totalBuyIns += (data.buyIn + data.rebuys);
        totalCashOuts += data.cashOut;
        playersActiveCount++;
      }
    });

    const discrepancy = totalCashOuts - totalBuyIns;

    return {
      totalBuyIns,
      totalCashOuts,
      discrepancy,
      playersActiveCount
    };
  }, [ledgerDraft]);

  const rawBalances = useMemo(() => {
    const balancesMap = {};
    config.players.forEach(p => {
      const data = ledgerDraft[p.id];
      const prevBal = getPreviousBalance(p.id);
      if (data && data.played) {
        balancesMap[p.id] = prevBal - data.buyIn - data.rebuys + data.cashOut;
      } else {
        balancesMap[p.id] = prevBal;
      }
    });
    return balancesMap;
  }, [ledgerDraft, config.players, sessionDay]);

  const isTargetDayPayday = useMemo(() => {
    return Number(sessionDay) > 0 && (Number(sessionDay) + 1) % config.paydayInterval === 0;
  }, [sessionDay, config.paydayInterval]);

  const projectedPaydays = useMemo(() => {
    return calculatePaydays(Number(sessionDay), config, rawBalances, loans || []);
  }, [sessionDay, config, rawBalances, loans]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (auditSummary.playersActiveCount === 0) {
      setError('Please check at least one player who participated in the session.');
      setIsLoading(false);
      return;
    }

    if (auditSummary.discrepancy !== 0) {
      setError(`Ledger discrepancy is ${auditSummary.discrepancy > 0 ? `+${auditSummary.discrepancy}` : auditSummary.discrepancy}. Chips must balance perfectly before saving.`);
      setIsLoading(false);
      return;
    }

    try {
      await saveSession(ledgerDraft, sessionDay);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save session: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-2.5 rounded-xl shadow-lg">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {editingSessionId ? `Edit Day ${sessionDay} Ledger` : 'Record Day Session Ledger'}
              </h2>
              <p className="text-xs text-zinc-500">
                {isTargetDayPayday ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Payday will be calculated automatically.
                  </span>
                ) : (
                  "Record granular end-of-day balances and log chip movements."
                )}
              </p>
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
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Session Day Input */}
            <div className="w-full sm:w-1/3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Session Day</label>
              <input
                type="number"
                value={sessionDay}
                onChange={e => setSessionDay(e.target.value)}
                disabled={!!editingSessionId}
                className="w-full bg-zinc-950 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-2.5 text-white font-bold text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            
            {/* Unified Chip Circulation Summary */}
            <div className="flex-1 flex items-center justify-between gap-4 p-2 bg-zinc-950/60 border border-white/5 rounded-lg text-xs w-full sm:self-end h-[42px]">
              <div className="flex items-center gap-6 pl-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 uppercase font-bold tracking-wider text-[9px]">Buy-Ins:</span>
                  <span className="font-mono font-bold text-zinc-200">{(auditSummary?.totalBuyIns || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 uppercase font-bold tracking-wider text-[9px]">Cash-Outs:</span>
                  <span className="font-mono font-bold text-zinc-200">{(auditSummary?.totalCashOuts || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all h-[30px] ${
                auditSummary.discrepancy === 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                <span className="uppercase font-bold tracking-wider text-[9px] opacity-80">Diff:</span>
                <div className="flex items-center gap-0.5 font-mono font-black">
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
          </div>

          {/* Player Ledger Sheet */}
          <div className="border border-white/5 rounded-2xl bg-zinc-950/40 p-2">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 z-10">Player</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-center z-10">Played</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Buy-In</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Rebuys</th>
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Cash-Out</th>
                  {isTargetDayPayday && (
                    <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Payday</th>
                  )}
                  <th className="sticky top-0 bg-zinc-950 border-b border-white/5 p-3 text-right z-10">Net Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {config.players.map(p => {
                  const data = ledgerDraft[p.id];
                  if (!data) return null;

                  const netPoker = data.cashOut - (data.buyIn + data.rebuys);
                  const paydayVal = projectedPaydays[p.id] || 0;
                  const totalNet = netPoker + paydayVal;

                  return (
                    <tr key={p.id} className={`transition-colors ${data.played ? 'bg-transparent' : 'opacity-40 hover:opacity-60'}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={data.played}
                            onChange={() => handleTogglePlayed(p.id)}
                            className="w-4 h-4 rounded border-white/10 bg-zinc-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-zinc-200">{p.name}</span>
                            <span className="block text-[9px] text-zinc-500 font-bold font-mono">ID: {p.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          data.played ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {data.played ? 'Yes' : 'No'}
                        </span>
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          disabled={!data.played}
                          value={data.buyIn}
                          onChange={(e) => handleChange(p.id, 'buyIn', e.target.value)}
                          className="w-20 bg-zinc-950 border border-white/5 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg p-1.5 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          disabled={!data.played}
                          value={data.rebuys}
                          onChange={(e) => handleChange(p.id, 'rebuys', e.target.value)}
                          className="w-20 bg-zinc-950 border border-white/5 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg p-1.5 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      <td className="p-3">
                        <input
                          type="number"
                          disabled={!data.played}
                          value={data.cashOut}
                          onChange={(e) => handleChange(p.id, 'cashOut', e.target.value)}
                          className="w-24 bg-zinc-950 border border-white/5 disabled:opacity-20 disabled:cursor-not-allowed rounded-lg p-1.5 text-right font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </td>

                      {isTargetDayPayday && (
                        <td className="p-3 text-right font-mono text-xs font-bold text-blue-400">
                          {paydayVal > 0 ? `+${(paydayVal || 0).toLocaleString()}` : '—'}
                        </td>
                      )}

                      <td className="p-3 text-right">
                        {data.played ? (
                          <span className={`font-mono font-bold text-xs ${totalNet > 0 ? 'text-emerald-400' : totalNet < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                            {totalNet > 0 ? `+${(totalNet || 0).toLocaleString()}` : (totalNet || 0).toLocaleString()}
                          </span>
                        ) : (
                          <span className="font-mono text-zinc-600">—</span>
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
        <div className="p-5 border-t border-white/5 bg-[#09090b] flex gap-3 justify-end">
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
            className="px-6 py-2.5 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
          >
            {isLoading ? (
              <>Saving... <Loader2 className="w-4 h-4 animate-spin" /></>
            ) : (
              <><Check className="h-4 w-4" /> Save Session Ledger</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
