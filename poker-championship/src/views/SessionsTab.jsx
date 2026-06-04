import { CalendarDays, Plus, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getSystemStateAtDay } from '../utils/pokerEngine';


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
        <div className="text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed">
          <CalendarDays className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">No days recorded</h3>
          <p className="text-zinc-500 text-sm mt-1">Start tracking by recording Day 1.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map(session => {
            const prevSession = sessions.find(s => Number(s.dayNumber) < Number(session.dayNumber));
            const currentDayState = getSystemStateAtDay(Number(session.dayNumber), config);
            const prevDayState = getSystemStateAtDay(prevSession ? Number(prevSession.dayNumber) : 0, config);
            const salaryBump = currentDayState.totalSalaryPerPlayer - prevDayState.totalSalaryPerPlayer;

            const dailyPL = {};
            config.players.forEach(p => {
              const currentBal = session.balances?.[p.id] ?? Number(p.startBalance);
              const prevBal    = prevSession?.balances?.[p.id] ?? Number(p.startBalance);
              const truePokerDiff = currentBal - prevBal - salaryBump; 
              if (truePokerDiff !== 0) dailyPL[p.name] = truePokerDiff;
            });

            const activePlayers = Object.entries(dailyPL).sort((a, b) => b[1] - a[1]);
            const isPayday = Number(session.dayNumber) > 0 && Number(session.dayNumber) % config.paydayInterval === 0;

            return (
              <div key={session.id} className="bg-zinc-900/40 border border-white/5 p-5 rounded-2xl flex flex-col relative overflow-hidden group">
                {isPayday && (
                  <div className="absolute top-0 left-0 w-full bg-blue-500/10 border-b border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase text-center py-1 tracking-widest">
                    Payday Distributed (+{config.salaryAmount.toLocaleString()})
                  </div>
                )}

                <div className={`flex justify-between items-start mb-4 border-b border-white/5 pb-4 ${isPayday ? 'mt-4' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase tracking-wider">Session</span>
                    </div>
                    <h3 className="text-xl font-bold text-white">Day {session.dayNumber}</h3>
                  </div>
                  {isAuthenticated && (
                    <button
                      onClick={() => { if (window.confirm(`Delete Day ${session.dayNumber}?`)) deleteSession(session.id); }}
                      className="text-zinc-600 hover:text-rose-400 transition-colors bg-zinc-900 hover:bg-rose-500/10 p-2 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                  {activePlayers.length === 0 ? (
                    <p className="text-sm text-zinc-600 italic">No movement recorded.</p>
                  ) : (
                    activePlayers.map(([name, val]) => (
                      <div key={name} className="flex justify-between items-center text-sm">
                        <span className="text-zinc-400 font-medium">{name}</span>
                        <span className={`font-mono font-medium flex items-center gap-1 ${val > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {val > 0 ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                          {Math.abs(val).toLocaleString()}
                        </span>
                      </div>
                    ))
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
