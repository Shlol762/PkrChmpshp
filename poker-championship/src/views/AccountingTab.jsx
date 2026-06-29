import { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Ghost, 
  ScrollText, 
  Pencil, 
  Play, 
  Coins, 
  Download, 
  User, 
  Filter, 
  Layers, 
  Wallet, 
  ArrowRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export default function AccountingTab({
  isAuthenticated,
  openSessionModal,
  sessions,
  config,
  deleteSession,
  activeSession,
  onStartDay,
  onOpenAudit,
  playerDeclarations,
  transactions = []
}) {
  const [subTab, setSubTab] = useState('sessions'); // 'sessions' or 'transactions'

  // Filter states
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [minDay, setMinDay] = useState('');
  const [maxDay, setMaxDay] = useState('');

  const checkedInCount = playerDeclarations 
    ? Object.values(playerDeclarations).filter(d => d.status === 'active' || d.status === 'cashed_out').length 
    : 0;
  const cashedOutCount = playerDeclarations 
    ? Object.values(playerDeclarations).filter(d => d.status === 'cashed_out').length 
    : 0;

  // Available players and types for filtering
  const allPlayers = useMemo(() => config?.players || [], [config]);
  const transactionTypes = ['BUY_IN', 'REBUY', 'CASH_OUT', 'LOAN_ISSUE', 'LOAN_SETTLE', 'PAYDAY', 'BALANCE_RESET', 'SESSION_CLOSE'];

  // Toggle multi-select item
  const togglePlayerFilter = (pid) => {
    setSelectedPlayers(prev => 
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  };

  const toggleTypeFilter = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    // Filter by player
    if (selectedPlayers.length > 0) {
      list = list.filter(tx => 
        (tx.from?.playerId && selectedPlayers.includes(tx.from.playerId)) ||
        (tx.to?.playerId && selectedPlayers.includes(tx.to.playerId))
      );
    }

    // Filter by type
    if (selectedTypes.length > 0) {
      list = list.filter(tx => selectedTypes.includes(tx.type));
    }

    // Filter by day range
    if (minDay !== '') {
      list = list.filter(tx => Number(tx.sessionDay) >= Number(minDay));
    }
    if (maxDay !== '') {
      list = list.filter(tx => Number(tx.sessionDay) <= Number(maxDay));
    }

    return list;
  }, [transactions, selectedPlayers, selectedTypes, minDay, maxDay]);

  // Compute running balance/net-worth if EXACTLY ONE player is selected
  const singlePlayerRunningBalances = useMemo(() => {
    if (selectedPlayers.length !== 1) return null;
    const pid = selectedPlayers[0];

    // Sort transactions oldest first to calculate running balance
    const sortedChronological = [...transactions]
      .filter(tx => 
        (tx.from?.playerId === pid) ||
        (tx.to?.playerId === pid)
      )
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    const balanceMap = {};
    let currentBalance = 0;

    sortedChronological.forEach(tx => {
      if (tx.from?.playerId === pid) {
        currentBalance -= tx.amount;
      }
      if (tx.to?.playerId === pid) {
        currentBalance += tx.amount;
      }
      balanceMap[tx.id] = currentBalance;
    });

    return balanceMap;
  }, [transactions, selectedPlayers]);

  // Reset all filters
  const resetFilters = () => {
    setSelectedPlayers([]);
    setSelectedTypes([]);
    setMinDay('');
    setMaxDay('');
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['Timestamp', 'Day', 'Type', 'From Player', 'From Account', 'To Player', 'To Account', 'Amount', 'Note'];
    const rows = filteredTransactions.map(tx => [
      tx.recordedAt,
      tx.sessionDay,
      tx.type,
      tx.from?.playerId || '',
      tx.from?.account || '',
      tx.to?.playerId || '',
      tx.to?.account || '',
      tx.amount,
      tx.note || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transaction_ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Sub-tab Pill Navigation */}
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setSubTab('sessions')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'sessions' 
                ? 'bg-zinc-800 text-white shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Daily Sessions</span>
          </button>
          <button
            onClick={() => setSubTab('transactions')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === 'transactions' 
                ? 'bg-zinc-800 text-white shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>Transaction Ledger</span>
          </button>
        </div>

        {subTab === 'sessions' && (
          <div className="flex gap-2">
            {!activeSession && (
              <button
                onClick={onStartDay}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] cursor-pointer"
              >
                <Play className="h-4 w-4" />
                <span>Start Day</span>
              </button>
            )}
            {isAuthenticated && (
              <button
                onClick={() => openSessionModal()}
                className="flex items-center gap-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-white/5 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Manual Entry</span>
              </button>
            )}
          </div>
        )}

        {subTab === 'transactions' && (
          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-850 text-zinc-300 border border-white/5 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Active Session banner */}
      {subTab === 'sessions' && isAuthenticated && activeSession && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-xl text-amber-400">
              <Coins className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Day {activeSession.dayNumber} is In Progress</h4>
              <p className="text-xs text-zinc-500">{checkedInCount} players checked in ({cashedOutCount} cashed out).</p>
            </div>
          </div>
          <button
            onClick={onOpenAudit}
            className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Audit & End Day</span>
          </button>
        </div>
      )}

      {/* Sessions View */}
      {subTab === 'sessions' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Daily Ledger</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Historical list of daily poker sessions and aggregate payouts.</p>
          </div>

          {(() => {
            const completedSessions = sessions.filter(s => s.status !== 'active');
            if (completedSessions.length === 0) {
              return (
                <div className="text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed flex flex-col items-center">
                  <ScrollText className="h-12 w-12 text-zinc-700 mx-auto mb-4 opacity-40" />
                  <h3 className="text-lg font-medium text-zinc-300">No days recorded</h3>
                  <p className="text-zinc-500 text-sm mt-1">Start tracking by recording Day 1.</p>
                </div>
              );
            }

            return (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedSessions.map((session, index) => {
                  const prevSession = completedSessions.find(s => Number(s.dayNumber) < Number(session.dayNumber));
                  const hasPaydays = session.paydaysDistributed && Object.values(session.paydaysDistributed).some(v => v > 0);

                  const dailyPL = [];
                  config.players.forEach(p => {
                    const currentBal = session.balances?.[p.id];
                    const prevBal = prevSession?.balances?.[p.id];

                    // Safely extract bank + wallet totals
                    const currentTotal = typeof currentBal === 'object' 
                      ? Number(currentBal.bank || 0) + Number(currentBal.wallet || 0)
                      : Number((currentBal ?? p.startBalance) || 0);

                    const prevTotal = typeof prevBal === 'object'
                      ? Number(prevBal.bank || 0) + Number(prevBal.wallet || 0)
                      : Number((prevBal ?? p.startBalance) || 0);

                    const paydayIncrease = session.paydaysDistributed?.[p.id] || 0;
                    const truePokerDiff = currentTotal - prevTotal - paydayIncrease;
                    
                    if (truePokerDiff !== 0 || paydayIncrease !== 0) {
                      dailyPL.push({ 
                        name: p.name, 
                        pokerDiff: truePokerDiff, 
                        payday: paydayIncrease, 
                        net: currentTotal - prevTotal 
                      });
                    }
                  });

                  dailyPL.sort((a, b) => b.net - a.net);

                  return (
                    <div key={session.id} className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col relative overflow-hidden group">
                      {hasPaydays && (
                        <div className="absolute top-0 left-0 w-full bg-blue-500/10 border-b border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase text-center py-1 tracking-widest">
                          Payday Distributed
                        </div>
                      )}

                      <div className={`flex justify-between items-start mb-4 border-b border-white/5 pb-4 ${hasPaydays ? 'mt-4' : ''}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase tracking-wider">Session</span>
                          </div>
                          <h3 className="text-xl font-bold text-white">Day {session.dayNumber}</h3>
                        </div>
                        {index === 0 && isAuthenticated && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openSessionModal(session)}
                              className="text-zinc-500 hover:text-blue-400 p-2 rounded-full hover:bg-blue-500/10 transition-colors cursor-pointer"
                              title="Edit latest session"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { if (window.confirm(`Delete Day ${session.dayNumber}?`)) deleteSession(session.id); }}
                              className="text-zinc-500 hover:text-rose-400 p-2 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Delete latest session"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                        {dailyPL.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 text-zinc-600">
                            <Ghost className="w-8 h-8 mb-2 opacity-10" />
                            <p className="text-sm italic">No movement recorded.</p>
                          </div>
                        ) : (
                          (() => {
                            const plItems = dailyPL.filter(item => item.pokerDiff !== 0);
                            const paydayItems = dailyPL.filter(item => item.payday > 0);
                            
                            return (
                              <div className="flex flex-col gap-2">
                                {plItems.length > 0 && (
                                  <div className="space-y-1">
                                    {plItems.map(item => (
                                      <div key={`pl-${item.name}`} className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-400 font-medium">{item.name}</span>
                                        <span className={`font-mono font-bold flex items-center gap-1 ${item.pokerDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {item.pokerDiff > 0 ? <ArrowUpRight className="w-3.5 h-3.5"/> : <ArrowDownRight className="w-3.5 h-3.5"/>}
                                          {Math.abs(item.pokerDiff).toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {plItems.length > 0 && paydayItems.length > 0 && (
                                  <div className="h-px bg-white/5 w-full" />
                                )}

                                {paydayItems.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold mb-0.5">Paydays Distributed</div>
                                    {paydayItems.map(item => (
                                      <div key={`payday-${item.name}`} className="flex justify-between items-center text-sm">
                                        <span className="text-zinc-400 font-medium">{item.name}</span>
                                        <span className="font-mono font-bold text-blue-400/50 flex items-center gap-1">
                                          <ArrowUpRight className="w-3 h-3"/>
                                          {item.payday.toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Transactions Tab */}
      {subTab === 'transactions' && (
        <div className="space-y-6">
          
          {/* Header */}
          <div>
            <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-zinc-400" /> Transaction Ledger
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Audit log of all balance modifications, transfer events, and administrative edits.</p>
          </div>

          {/* Filters Section */}
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Ledger</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              
              {/* Player multi-select filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Players</label>
                <div className="max-h-32 overflow-y-auto border border-white/5 rounded-xl p-2 bg-zinc-950/50 space-y-1">
                  {allPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePlayerFilter(p.id)}
                      className={`w-full text-left text-xs px-2 py-1 rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedPlayers.includes(p.id) 
                          ? 'bg-zinc-800 text-white font-semibold' 
                          : 'text-zinc-500 hover:bg-zinc-900'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="font-mono text-[9px] text-zinc-600">{p.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Event Types</label>
                <div className="max-h-32 overflow-y-auto border border-white/5 rounded-xl p-2 bg-zinc-950/50 space-y-1">
                  {transactionTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleTypeFilter(t)}
                      className={`w-full text-left text-xs px-2 py-1 rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedTypes.includes(t) 
                          ? 'bg-zinc-800 text-white font-semibold' 
                          : 'text-zinc-500 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="text-[10px] tracking-wide">{t.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Day */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Min Day</label>
                <input
                  type="number"
                  placeholder="Day number"
                  value={minDay}
                  onChange={e => setMinDay(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl p-2 text-xs text-white placeholder-zinc-700 outline-none focus:border-white/20 font-mono"
                />
              </div>

              {/* Max Day */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Max Day</label>
                  <input
                    type="number"
                    placeholder="Day number"
                    value={maxDay}
                    onChange={e => setMaxDay(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl p-2 text-xs text-white placeholder-zinc-700 outline-none focus:border-white/20 font-mono"
                  />
                </div>
                
                {/* Reset button */}
                <button
                  onClick={resetFilters}
                  className="mt-2 w-full text-center text-xs font-bold text-zinc-500 hover:text-zinc-300 py-2 border border-dashed border-white/5 hover:border-white/20 rounded-xl transition-all cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>

            </div>
          </div>

          {/* Transactions Log Table */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="p-3.5 pl-5">Date/Time</th>
                    <th className="p-3.5 font-mono">Day</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Transfer Path</th>
                    <th className="p-3.5 text-right">Amount</th>
                    {selectedPlayers.length === 1 && (
                      <th className="p-3.5 text-right text-amber-500 font-semibold flex items-center justify-end gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Running Bal</span>
                      </th>
                    )}
                    <th className="p-3.5 pr-5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPlayers.length === 1 ? 7 : 6} className="text-center py-16 text-zinc-600">
                        <Ghost className="w-8 h-8 mx-auto mb-2 opacity-10" />
                        <p className="italic">No transaction records match these criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const dateObj = new Date(tx.recordedAt);
                      const formattedTime = dateObj.toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      // Format routing string
                      let pathString = '-';
                      if (tx.from || tx.to) {
                        const fromLabel = tx.from 
                          ? `${tx.from.playerId} [${tx.from.account}]` 
                          : 'BANK';
                        const toLabel = tx.to 
                          ? `${tx.to.playerId} [${tx.to.account}]` 
                          : 'OUTFLOW';
                        
                        pathString = (
                          <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                            <span className="font-semibold text-zinc-300">{fromLabel}</span>
                            <ArrowRight className="w-3 h-3 text-zinc-600" />
                            <span className="font-semibold text-zinc-300">{toLabel}</span>
                          </div>
                        );
                      }

                      // Type badges styling
                      let badgeStyle = 'bg-zinc-800 text-zinc-400';
                      if (tx.type === 'BUY_IN' || tx.type === 'REBUY') badgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/10';
                      if (tx.type === 'CASH_OUT') badgeStyle = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10';
                      if (tx.type === 'LOAN_ISSUE') badgeStyle = 'bg-rose-500/10 text-rose-400 border border-rose-500/10';
                      if (tx.type === 'LOAN_SETTLE') badgeStyle = 'bg-purple-500/10 text-purple-400 border border-purple-500/10';
                      if (tx.type === 'PAYDAY') badgeStyle = 'bg-blue-500/10 text-blue-400 border border-blue-500/10';
                      if (tx.type === 'BALANCE_RESET') badgeStyle = 'bg-zinc-800 text-zinc-300 border border-white/5';
                      if (tx.type === 'SESSION_CLOSE') badgeStyle = 'bg-zinc-950/70 text-zinc-500';

                      return (
                        <tr key={tx.id} className="hover:bg-white/1 transition-colors text-zinc-300">
                          <td className="p-3.5 pl-5 text-zinc-500 font-medium whitespace-nowrap">{formattedTime}</td>
                          <td className="p-3.5 font-mono font-bold text-zinc-500">D{tx.sessionDay}</td>
                          <td className="p-3.5">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md tracking-wide ${badgeStyle}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-3.5">{pathString}</td>
                          <td className="p-3.5 text-right font-mono font-bold text-white whitespace-nowrap">
                            {tx.amount.toLocaleString()}
                          </td>
                          {selectedPlayers.length === 1 && (
                            <td className="p-3.5 text-right font-mono font-bold text-amber-400/90 whitespace-nowrap">
                              {singlePlayerRunningBalances?.[tx.id] !== undefined 
                                ? singlePlayerRunningBalances[tx.id].toLocaleString() 
                                : '-'}
                            </td>
                          )}
                          <td className="p-3.5 pr-5 text-zinc-500 max-w-xs truncate" title={tx.note}>{tx.note || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
