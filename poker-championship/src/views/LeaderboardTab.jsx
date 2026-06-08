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
              {config.maxSystemNW > 0 && actualSystemNetWorth >= config.maxSystemNW ? 'Maxed Out' : `Day ${currentDay + nextPaydayIn}`}
            </span>
            {(!config.maxSystemNW || actualSystemNetWorth < config.maxSystemNW) && (
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
        
        <div className="space-y-2">
          {(() => {
            let currentDisplayRank = 1;
            return playerStats.map((stat, index) => {
              if (index > 0) {
                const prevStat = playerStats[index - 1];
                const prevBaseline = Number(prevStat.startBalance || 0) + (prevStat.salary || 0);
                const currBaseline = Number(stat.startBalance || 0) + (stat.salary || 0);
                
                const prevPct = prevBaseline === 0 ? 0 : prevStat.tablePL / prevBaseline;
                const currPct = currBaseline === 0 ? 0 : stat.tablePL / currBaseline;

                if (stat.netWorth !== prevStat.netWorth || currPct !== prevPct) {
                  currentDisplayRank = index + 1;
                }
              }

              const isTop3 = currentDisplayRank <= 3;
              const rankColors = [
                'bg-amber-400 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.2)] border-amber-400/50',
                'bg-zinc-300 text-zinc-900 shadow-[0_0_15px_rgba(212,212,216,0.1)] border-zinc-300/50',
                'bg-orange-700 text-orange-100 shadow-[0_0_15px_rgba(194,65,12,0.2)] border-orange-700/50'
              ];
              const badgeClass = isTop3 ? rankColors[currentDisplayRank - 1] : 'bg-zinc-800 text-zinc-400 border-white/5';
              const rowClass = currentDisplayRank === 1 
                ? 'bg-gradient-to-r from-amber-500/10 to-zinc-900/40 border-amber-500/20' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/40';

              return (
                <div key={stat.id} className={`group relative border rounded-2xl py-2.5 px-3 sm:px-4 transition-all duration-300 ${rowClass}`}>
                  <div className="flex items-center justify-between">
                    
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs border ${badgeClass} shrink-0 mt-0.5`}>
                        {currentDisplayRank}
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold ${currentDisplayRank === 1 ? 'text-amber-400' : 'text-zinc-100'}`}>
                          {stat.name}
                        </h3>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5 font-medium">
                        <span className="flex items-center gap-1" title="Table Balance">
                          <Wallet className="w-3 h-3"/> {stat.currentTableBalance.toLocaleString()}
                        </span>
                        {(stat.lentOut > 0 || stat.borrowed > 0) && (
                          <span className="flex items-center gap-1.5" title="Net Loans (Principal & Interest)">
                            <HandCoins className="w-3 h-3 text-zinc-500"/> 
                            <span className={stat.lentOutPrincipal > stat.borrowedPrincipal ? 'text-emerald-500/80 font-semibold' : 'text-rose-500/80 font-semibold'}>
                              {stat.lentOutPrincipal > stat.borrowedPrincipal ? '+' : ''}
                              {(stat.lentOutPrincipal - stat.borrowedPrincipal).toLocaleString()}
                            </span>
                            {(stat.lentOutInterest > 0 || stat.borrowedInterest > 0) && (
                              <span className={`text-[10px] font-semibold ${stat.lentOutInterest > stat.borrowedInterest ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                                ({stat.lentOutInterest > stat.borrowedInterest ? '+' : ''}
                                {(stat.lentOutInterest - stat.borrowedInterest).toLocaleString()} int)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight leading-none mb-1">
                      {stat.netWorth.toLocaleString()}
                    </div>
                    <div className="flex flex-col items-end gap-0">
                      <div className={`py-0.5 flex items-center gap-1 text-xs font-semibold tracking-wide uppercase ${stat.tablePL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stat.tablePL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {(() => {
                          const baseline = Number(stat.startBalance || 0) + Number(stat.salary || 0);
                          const pct = baseline === 0 ? 0 : (Math.abs(stat.tablePL) / baseline) * 100;
                          return (
                            <span>
                              {pct.toFixed(1)}% <span className="opacity-60 ml-0.5 text-[11px]">({Math.abs(stat.tablePL).toLocaleString()})</span>
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-[11px] font-semibold text-zinc-500/80 uppercase tracking-widest leading-none mt-1">
                        <span className="opacity-60">P/L based off </span>
                        <span className="text-zinc-300">{(Number(stat.startBalance || 0) + Number(stat.salary || 0)).toLocaleString()}</span>
                        <span className="opacity-50 ml-1.5 text-[10px]">({Number(stat.startBalance || 0).toLocaleString()} Start + <span className="text-blue-300/80">{Number(stat.salary || 0).toLocaleString()} Pay</span>)</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
