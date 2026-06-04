import { Wallet, Banknote, Clock, TrendingUp, TrendingDown, HandCoins } from 'lucide-react';


export default function LeaderboardTab({
  actualSystemNetWorth,
  config,
  salaryPerPlayer,
  totalPaydays,
  currentDay,
  nextPaydayIn,
  playerStats
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">System Net Worth</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">{actualSystemNetWorth.toLocaleString()}</span>
            <span className="text-xs text-zinc-500">/ {config.maxSystemNW.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Banknote className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Salary Ledger</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">+{salaryPerPlayer.toLocaleString()}</span>
            <span className="text-xs text-zinc-500">({totalPaydays} payouts)</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-zinc-400 mb-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Next Payday</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {actualSystemNetWorth >= config.maxSystemNW ? 'Maxed Out' : `Day ${currentDay + nextPaydayIn}`}
            </span>
            {actualSystemNetWorth < config.maxSystemNW && (
              <span className="text-xs text-zinc-500">(in {nextPaydayIn} days)</span>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard List */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
          <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Net Worth</span>
        </div>
        
        <div className="space-y-3">
          {playerStats.map((stat, index) => {
            const isTop3 = index < 3;
            const rankColors = [
              'bg-amber-400 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.2)] border-amber-400/50',
              'bg-zinc-300 text-zinc-900 shadow-[0_0_15px_rgba(212,212,216,0.1)] border-zinc-300/50',
              'bg-orange-700 text-orange-100 shadow-[0_0_15px_rgba(194,65,12,0.2)] border-orange-700/50'
            ];
            const badgeClass = isTop3 ? rankColors[index] : 'bg-zinc-800 text-zinc-400 border-white/5';
            const rowClass = index === 0 
              ? 'bg-gradient-to-r from-amber-500/10 to-zinc-900/40 border-amber-500/20' 
              : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/40';

            return (
              <div key={stat.id} className={`group relative border rounded-2xl p-4 transition-all duration-300 ${rowClass}`}>
                <div className="flex items-center justify-between">
                  
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${badgeClass}`}>
                      {index + 1}
                    </div>
                    <div>
                      <h3 className={`text-base font-semibold ${index === 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
                        {stat.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5 font-medium">
                        <span className="flex items-center gap-1" title="Table Balance">
                          <Wallet className="w-3 h-3"/> {stat.currentTableBalance.toLocaleString()}
                        </span>
                        {(stat.lentOut > 0 || stat.borrowed > 0) && (
                          <span className="flex items-center gap-1" title="Net Loans">
                            <HandCoins className="w-3 h-3"/> 
                            <span className={stat.lentOut > stat.borrowed ? 'text-emerald-500/80' : 'text-rose-500/80'}>
                              {stat.lentOut > stat.borrowed ? '+' : ''}{(stat.lentOut - stat.borrowed).toLocaleString()}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight">
                      {stat.netWorth.toLocaleString()}
                    </div>
                    <div className={`flex items-center gap-0.5 text-[11px] font-semibold tracking-wide uppercase mt-0.5 ${stat.tablePL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stat.tablePL >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(stat.tablePL).toLocaleString()} P/L
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
