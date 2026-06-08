import { CalendarDays, Plus, Trash2, ArrowUpRight, ArrowDownRight, Ghost, ScrollText, Pencil } from 'lucide-react';

export default function SessionsTab({
  isAuthenticated,
  openSessionModal,
  sessions,
  config,
  deleteSession
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Daily Ledger</h2>
          <p className="text-sm text-zinc-500">Record physical table chips.</p>
        </div>
        {isAuthenticated && (
          <button
            onClick={openSessionModal}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2.5 px-5 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Record Day</span>
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed flex flex-col items-center">
          <ScrollText className="h-12 w-12 text-zinc-700 mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-medium text-zinc-300">No days recorded</h3>
          <p className="text-zinc-500 text-sm mt-1">Start tracking by recording Day 1.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session, index) => {
            const prevSession = sessions.find(s => Number(s.dayNumber) < Number(session.dayNumber));

            const hasPaydays = session.paydaysDistributed && Object.values(session.paydaysDistributed).some(v => v > 0);

            const dailyPL = [];
            config.players.forEach(p => {
              const currentBal = session.balances?.[p.id] ?? Number(p.startBalance || 0);
              const prevBal    = prevSession?.balances?.[p.id] ?? Number(p.startBalance || 0);
              
              const paydayIncrease = session.paydaysDistributed?.[p.id] || 0;
              const truePokerDiff = currentBal - prevBal - paydayIncrease;
              
              if (truePokerDiff !== 0 || paydayIncrease !== 0) {
                dailyPL.push({ name: p.name, pokerDiff: truePokerDiff, payday: paydayIncrease, net: currentBal - prevBal });
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
                        className="text-zinc-500 hover:text-blue-400 p-2 rounded-full hover:bg-blue-500/10 transition-colors"
                        title="Edit latest session"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete Day ${session.dayNumber}?`)) deleteSession(session.id); }}
                        className="text-zinc-500 hover:text-rose-400 p-2 rounded-full hover:bg-rose-500/10 transition-colors"
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
                                    {item.pokerDiff > 0 ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
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
      )}
    </div>
  );
}
