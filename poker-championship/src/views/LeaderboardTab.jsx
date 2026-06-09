import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, Wallet, Banknote, Clock, TrendingUp, TrendingDown, HandCoins, Target, ArrowRight, ArrowLeft, Minus } from 'lucide-react';

export default function LeaderboardTab({
  actualSystemNetWorth,
  config,
  salaryPerPlayer,
  totalPaydays,
  currentDay,
  nextPaydayIn,
  playerStats,
  loans = []
}) {
  const [expandedCards, setExpandedCards] = useState(() => {
    return new Set(playerStats?.length > 0 ? [playerStats[0].id] : []);
  });

  const toggleCard = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HUD Pill Stats */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        
        {/* System NW Pill */}
        <div className="flex items-center gap-2 min-w-0 group bg-zinc-900/60 border border-white/5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 shadow-sm backdrop-blur-sm truncate">
          <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors hidden sm:inline-block shrink-0">Sys NW</span>
          <div className="flex items-baseline gap-1 truncate">
            <span className="text-sm sm:text-base font-bold text-white tabular-nums drop-shadow-md truncate">{actualSystemNetWorth.toLocaleString()}</span>
          </div>
        </div>

        {/* Next Payday Pill */}
        <div className="flex items-center gap-2 min-w-0 group bg-zinc-900/60 border border-white/5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 shadow-sm backdrop-blur-sm truncate">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors hidden sm:inline-block shrink-0">Next Payday</span>
          <div className="flex items-baseline gap-1 truncate">
            <span className="text-sm sm:text-base font-bold text-white drop-shadow-md truncate">
              {`+${(config.paydayMax || 0).toLocaleString()} max ➔ End of Day ${currentDay + nextPaydayIn - 1}`}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-zinc-600 ml-0.5 shrink-0">
              ({totalPaydays}x)
            </span>
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
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ 
                    layout: { type: "spring", stiffness: 400, damping: 38 },
                    opacity: { duration: 0.4, delay: index * 0.08 },
                    y: { type: "spring", stiffness: 400, damping: 30, delay: index * 0.08 }
                  }}
                  key={stat.id} 
                  onClick={() => toggleCard(stat.id)}
                  className={`group relative border rounded-2xl py-2.5 px-3 sm:px-4 transition-colors duration-300 cursor-pointer ${rowClass} ${expandedCards.has(stat.id) ? 'shadow-lg bg-zinc-800/40' : ''}`}
                >
                  <div className="flex flex-col">
                    
                    {/* Header Row: Rank, Name, Net Worth */}
                    <motion.div layout="position" className="flex items-center justify-between gap-3 min-w-0 px-1">
                      <motion.div layout="position" className="flex items-center gap-3 min-w-0 pointer-events-none">
                        <motion.div layout="position" className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${badgeClass} shrink-0`}>
                          {currentDisplayRank}
                        </motion.div>
                        <motion.h3 layout="position" className={`text-base sm:text-lg font-bold truncate ${currentDisplayRank === 1 ? 'text-amber-400' : 'text-zinc-100'}`}>
                          {stat.name}
                        </motion.h3>
                      </motion.div>
                      <motion.div layout="position" className="text-xl sm:text-2xl font-bold text-white tabular-nums shrink-0 pointer-events-none">
                        {stat.netWorth.toLocaleString()}
                      </motion.div>
                    </motion.div>

                    {/* Condensed & Expanded Row Toggle */}
                    {!expandedCards.has(stat.id) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1.5 text-xs font-medium text-zinc-400 mt-1 pl-12 pointer-events-none pr-2">
                        <motion.div layoutId={`phys-box-${stat.id}`} className="flex items-center justify-start gap-1.5 truncate text-amber-100/90 rounded-lg overflow-hidden" title="Physical Balance">
                          <motion.div layoutId={`phys-icon-${stat.id}`}><Wallet className="w-3.5 h-3.5 shrink-0 text-amber-500/80" /></motion.div> 
                          <motion.span layoutId={`phys-val-${stat.id}`} className="truncate">{stat.currentTableBalance.toLocaleString()}</motion.span>
                        </motion.div>

                        <motion.div layoutId={`pl-box-${stat.id}`} className={`flex items-center justify-end sm:justify-start gap-1.5 truncate rounded-lg overflow-hidden ${stat.tablePL === 0 ? 'text-zinc-500' : stat.tablePL > 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`} title="Profit/Loss">
                          <motion.div layoutId={`pl-icon-${stat.id}`}>
                            {stat.tablePL === 0 ? <Minus className="w-3.5 h-3.5 shrink-0" /> : stat.tablePL > 0 ? <TrendingUp className="w-3.5 h-3.5 shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 shrink-0" />} 
                          </motion.div>
                          <motion.span layoutId={`pl-val-${stat.id}`} className="truncate">
                            {(() => {
                              const baseline = Number(stat.startBalance || 0) + Number(stat.salary || 0);
                              return baseline === 0 ? '0.0%' : `${stat.tablePL > 0 ? '+' : ''}${((stat.tablePL / baseline) * 100).toFixed(1)}%`;
                            })()}
                          </motion.span>
                        </motion.div>

                        {(() => {
                          const activeLoans = (loans || []).filter(l => l.status === 'active' && (l.lender === stat.id || l.borrower === stat.id));
                          if (activeLoans.length === 0) return <motion.div layoutId={`loan-box-${stat.id}`} className="rounded-lg overflow-hidden" />;
                          const loan = activeLoans[0];
                          const isLender = loan.lender === stat.id;
                          const otherPlayerId = isLender ? loan.borrower : loan.lender;
                          const color = isLender ? 'text-emerald-500/80' : 'text-rose-500/80';
                          return (
                            <motion.div layoutId={`loan-box-${stat.id}`} className={`flex items-center justify-start gap-1.5 truncate rounded-lg overflow-hidden ${color}`} title="First Active Loan">
                              <motion.div layoutId={`loan-icon-${stat.id}`}><HandCoins className="w-3 h-3 shrink-0" /></motion.div> 
                              <motion.span layoutId={`loan-val-${stat.id}`} className="flex items-center truncate">
                                {(Number(loan.amount)/1000).toFixed(1).replace(/\.0$/, '')}k@{loan.interest}%
                                {isLender ? <ArrowRight className="w-3 h-3 mx-0.5 shrink-0" /> : <ArrowLeft className="w-3 h-3 mx-0.5 shrink-0" />}
                                <span className="truncate">{otherPlayerId}</span>
                                {activeLoans.length > 1 && <span className="opacity-60 text-[9px] ml-0.5 shrink-0">(+{activeLoans.length - 1})</span>}
                              </motion.span>
                            </motion.div>
                          );
                        })()}

                        <motion.div layoutId={`base-box-${stat.id}`} className="flex items-center justify-end sm:justify-start gap-1.5 truncate text-sky-100/90 rounded-lg overflow-hidden" title="Baseline">
                          <motion.div layoutId={`base-icon-${stat.id}`}><Target className="w-3.5 h-3.5 shrink-0 text-sky-400/80" /></motion.div> 
                          <motion.span layoutId={`base-val-${stat.id}`} className="truncate">{(Number(stat.startBalance || 0) + Number(stat.salary || 0)).toLocaleString()}</motion.span>
                        </motion.div>
                      </div>
                    ) : (
                      <motion.div layout="position" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 pointer-events-none">
                        
                        {/* Physical Balance */}
                        <motion.div layoutId={`phys-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            <motion.div layoutId={`phys-icon-${stat.id}`}><Wallet className="w-3 h-3 text-amber-500/80"/></motion.div> Physical
                          </motion.span>
                          <motion.div layout="position" className="flex flex-col items-center justify-center mt-auto w-full">
                            <motion.div layout="position" className="flex flex-col items-center justify-center mt-1.5 mb-0.5">
                              <motion.span layoutId={`phys-val-${stat.id}`} className="text-xs sm:text-sm font-semibold text-amber-100/90">
                                {stat.currentTableBalance.toLocaleString()}
                              </motion.span>
                            </motion.div>
                            <motion.div layout="position" className="h-[14px]"></motion.div>
                          </motion.div>
                        </motion.div>

                        {/* Profit/Loss */}
                        <motion.div layoutId={`pl-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            <motion.div layoutId={`pl-icon-${stat.id}`}>
                              {stat.tablePL === 0 ? <Minus className="w-3 h-3 text-zinc-500" /> : stat.tablePL > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                            </motion.div> P/L
                          </motion.span>
                          <motion.div layout="position" className="flex flex-col items-center justify-center mt-auto w-full">
                            {(() => {
                              const baseline = Number(stat.startBalance || 0) + Number(stat.salary || 0);
                              const pct = baseline === 0 ? 0 : (stat.tablePL / baseline) * 100;
                              return (
                                <>
                                  <motion.div layout="position" className="flex flex-col items-center justify-center mt-1.5 mb-0.5">
                                    <motion.span layoutId={`pl-val-${stat.id}`} className={`text-xs sm:text-sm font-bold ${stat.tablePL === 0 ? 'text-zinc-500' : stat.tablePL > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                                    </motion.span>
                                  </motion.div>
                                  <motion.div layout="position" className="flex items-center justify-center h-[14px]">
                                    <motion.span layout="position" className={`text-[9px] font-medium ${stat.tablePL === 0 ? 'text-zinc-500/70' : stat.tablePL > 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                      ({stat.tablePL > 0 ? '+' : ''}{stat.tablePL.toLocaleString()})
                                    </motion.span>
                                  </motion.div>
                                </>
                              );
                            })()}
                          </motion.div>
                        </motion.div>

                        {/* Loans */}
                        <motion.div layoutId={`loan-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            <motion.div layoutId={`loan-icon-${stat.id}`}><HandCoins className="w-3 h-3 text-indigo-400/80"/></motion.div> Active Loans
                          </motion.span>
                          <motion.div layout="position" className="flex flex-col items-center justify-center mt-auto w-full">
                            <motion.div layout="position" className="flex flex-col items-center justify-center mt-1.5 mb-0.5 w-full gap-0.5">
                              {(() => {
                                const activeLoans = (loans || []).filter(l => l.status === 'active' && (l.lender === stat.id || l.borrower === stat.id));
                                if (activeLoans.length === 0) {
                                  return <motion.span layoutId={`loan-val-${stat.id}`} className="text-xs sm:text-sm font-semibold text-indigo-200/50">None</motion.span>;
                                }
                                
                                return (
                                  <motion.div layoutId={`loan-val-${stat.id}`} className="flex flex-col items-center gap-0.5">
                                    {activeLoans.map(loan => {
                                      const isLender = loan.lender === stat.id;
                                      const otherPlayerId = isLender ? loan.borrower : loan.lender;
                                      const otherPlayerName = config.players?.find(p => p.id === otherPlayerId)?.name || otherPlayerId;
                                      
                                      if (isLender) {
                                        return (
                                          <motion.div layout="position" key={loan.id} className="text-xs sm:text-sm font-medium text-emerald-400/80 leading-tight">
                                            lent {Number(loan.amount).toLocaleString()}@{loan.interest}% to {otherPlayerName}
                                          </motion.div>
                                        );
                                      } else {
                                        return (
                                          <motion.div layout="position" key={loan.id} className="text-xs sm:text-sm font-medium text-rose-400/80 leading-tight">
                                            borrowed {Number(loan.amount).toLocaleString()}@{loan.interest}% from {otherPlayerName}
                                          </motion.div>
                                        );
                                      }
                                    })}
                                  </motion.div>
                                );
                              })()}
                            </motion.div>
                            <motion.div layout="position" className="h-[14px]"></motion.div>
                          </motion.div>
                        </motion.div>

                        {/* Baseline */}
                        <motion.div layoutId={`base-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            <motion.div layoutId={`base-icon-${stat.id}`}><Target className="w-3 h-3 text-sky-400/80"/></motion.div> Baseline
                          </motion.span>
                          <motion.div layout="position" className="flex flex-col items-center justify-center mt-auto w-full">
                            <motion.div layout="position" className="flex flex-col items-center justify-center mt-1.5 mb-0.5">
                              <motion.span layoutId={`base-val-${stat.id}`} className="text-xs sm:text-sm font-semibold text-sky-100/90">
                                {(Number(stat.startBalance || 0) + Number(stat.salary || 0)).toLocaleString()}
                              </motion.span>
                            </motion.div>
                            <motion.div layout="position" className="flex items-center justify-center gap-1 text-[9px] font-medium text-zinc-500/80 w-full h-[14px]">
                              <motion.span layout="position">{Number(stat.startBalance || 0).toLocaleString()} START</motion.span>
                              <motion.span layout="position">+</motion.span>
                              <motion.span layout="position" className="text-sky-300/70">{Number(stat.salary || 0).toLocaleString()} PAY</motion.span>
                            </motion.div>
                          </motion.div>
                        </motion.div>

                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
