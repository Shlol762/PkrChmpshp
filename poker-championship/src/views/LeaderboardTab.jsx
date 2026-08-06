import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, Wallet, Banknote, Clock, TrendingUp, TrendingDown, HandCoins, Target, ArrowRight, ArrowLeft, Minus, CalendarDays, Hourglass } from 'lucide-react';

const getRoundDayString = (day) => {
  const dayNum = Number(day || 0);
  if (dayNum === 0) return 'R1D0';
  if (dayNum <= 30) {
    return `R1D${dayNum}`;
  } else {
    return `R2D${dayNum - 30}`;
  }
};

import { calculatePlayerStats } from '../utils/pokerEngine';

export default function LeaderboardTab({
  actualSystemNetWorth,
  config,
  salaryPerPlayer,
  totalPaydays,
  currentDay,
  nextPaydayIn,
  playerStats: initialPlayerStats,
  loans = [],
  activeSession = null,
  playerDeclarations = {},
  sessions = [],
  balances = {}
}) {
  const activeRound = (config && config.currentRound === 2) || currentDay > 30 ? 2 : 1;
  const [selectedRound, setSelectedRound] = useState(activeRound);

  const currentRoundStats = useMemo(() => {
    return calculatePlayerStats(sessions, loans, currentDay, config, balances, selectedRound, playerDeclarations);
  }, [sessions, loans, currentDay, config, balances, selectedRound, playerDeclarations]);

  const [expandedCards, setExpandedCards] = useState(() => {
    return new Set(currentRoundStats?.length > 0 ? [currentRoundStats[0].id] : []);
  });

  const [isInflationAdjusted, setIsInflationAdjusted] = useState(false);

  const roundStartSupply = useMemo(() => {
    return config?.players?.reduce((sum, p) => {
      const sb = selectedRound === 2 
        ? Number(p.r2StartBalance !== undefined ? p.r2StartBalance : 5000) 
        : Number(p.startBalance || 0);
      return sum + sb;
    }, 0) || 0;
  }, [config, selectedRound]);

  const currentSupply = useMemo(() => {
    return currentRoundStats?.reduce((sum, p) => sum + Number(p.currentTableBalance || 0), 0) || 0;
  }, [currentRoundStats]);

  const inflationRate = roundStartSupply > 0 ? (currentSupply / roundStartSupply) : 1.0;

  const roundSystemNetWorth = useMemo(() => {
    return currentRoundStats.reduce((sum, p) => sum + p.netWorth, 0);
  }, [currentRoundStats]);

  const roundTotalPaydays = useMemo(() => {
    let count = 0;
    sessions.forEach(s => {
      const sDay = Number(s.dayNumber);
      const sIsRound2 = sDay > 30;
      const isTargetRound = selectedRound === 2 ? sIsRound2 : !sIsRound2;
      if (isTargetRound && s.paydaysDistributed && Object.keys(s.paydaysDistributed).length > 0) {
        count++;
      }
    });
    return count;
  }, [sessions, selectedRound]);

  const toggleCard = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayDayString = useMemo(() => {
    if (selectedRound === activeRound) {
      return getRoundDayString(currentDay);
    } else {
      const roundSessions = sessions.filter(s => {
        const sDay = Number(s.dayNumber);
        return selectedRound === 2 ? sDay > 30 : sDay <= 30;
      });
      if (roundSessions.length === 0) return selectedRound === 2 ? 'R2D0' : 'R1D0';
      const maxDay = Math.max(...roundSessions.map(s => Number(s.dayNumber)));
      return getRoundDayString(maxDay) + ' (Completed)';
    }
  }, [selectedRound, activeRound, currentDay, sessions]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Round Tabs Switcher (only shown if activeRound is 2) */}
      {activeRound === 2 && (
        <div className="flex bg-zinc-950/80 p-1 rounded-xl border border-white/5 w-fit shadow-lg backdrop-blur-md">
          <button
            onClick={() => setSelectedRound(1)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedRound === 1 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Round 1
          </button>
          <button
            onClick={() => setSelectedRound(2)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedRound === 2 
                ? 'bg-amber-500 text-amber-950 shadow-md' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Round 2
          </button>
        </div>
      )}

      {/* HUD Pill Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        
        {/* System NW Pill */}
        <div className="flex items-center gap-2 min-w-0 group bg-zinc-900/60 border border-white/5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 shadow-sm backdrop-blur-sm truncate">
          <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors hidden sm:inline-block shrink-0">
            {isInflationAdjusted ? 'Sys NW (True)' : 'Sys NW'}
          </span>
          <div className="flex items-baseline gap-1 truncate">
            <span className="text-sm sm:text-base font-bold text-white tabular-nums drop-shadow-md truncate">
              {Math.round(isInflationAdjusted ? roundSystemNetWorth / inflationRate : roundSystemNetWorth).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Next Payday Pill (only shown if selectedRound is activeRound) */}
        {selectedRound === activeRound && (
          <div className="flex items-center gap-2 min-w-0 group bg-zinc-900/60 border border-white/5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 shadow-sm backdrop-blur-sm truncate">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors hidden sm:inline-block shrink-0">Next Payday</span>
            <div className="flex items-baseline gap-1 truncate">
              <span className="text-sm sm:text-base font-bold text-white drop-shadow-md truncate">
                {`+${Math.round(isInflationAdjusted ? (config.paydayMax || 0) / inflationRate : (config.paydayMax || 0)).toLocaleString()} max ➔ End of ${getRoundDayString(currentDay + nextPaydayIn - 1)}`}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-zinc-600 ml-0.5 shrink-0">
                ({roundTotalPaydays}x)
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Leaderboard List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Leaderboard</h2>
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono">
              {displayDayString}
            </span>
            <div className="flex items-center bg-zinc-950 border border-white/5 rounded-full p-0.5 text-[9px] font-bold">
              <button
                onClick={() => setIsInflationAdjusted(false)}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  !isInflationAdjusted
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Current Money
              </button>
              <button
                onClick={() => setIsInflationAdjusted(true)}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  isInflationAdjusted
                    ? 'bg-amber-500 text-amber-950'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                True Value ({inflationRate.toFixed(2)}x)
              </button>
            </div>
          </div>
          <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
            {isInflationAdjusted ? 'Net Worth (True Value)' : 'Net Worth'}
          </span>
        </div>
        
        <div className="space-y-2">
          {(() => {
            let currentDisplayRank = 1;
            return currentRoundStats.map((stat, index) => {
              const displayNetWorth = isInflationAdjusted ? Math.round(stat.netWorth / inflationRate) : stat.netWorth;
              const displayTableBalance = isInflationAdjusted ? Math.round(stat.currentTableBalance / inflationRate) : stat.currentTableBalance;
              const displayBank = isInflationAdjusted ? Math.round((stat.bank || 0) / inflationRate) : (stat.bank || 0);
              const displayWallet = isInflationAdjusted ? Math.round((stat.wallet || 0) / inflationRate) : (stat.wallet || 0);
              const displayTablePL = isInflationAdjusted ? Math.round(stat.tablePL / inflationRate) : stat.tablePL;
              const displayBaseline = isInflationAdjusted 
                ? Math.round((Number(stat.startBalance || 0) + Number(stat.salary || 0)) / inflationRate)
                : (Number(stat.startBalance || 0) + Number(stat.salary || 0));
              const displayStartBalance = isInflationAdjusted ? Math.round(Number(stat.startBalance || 0) / inflationRate) : Number(stat.startBalance || 0);
              const displaySalary = isInflationAdjusted ? Math.round(Number(stat.salary || 0) / inflationRate) : Number(stat.salary || 0);

              if (index > 0) {
                const prevStat = currentRoundStats[index - 1];
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
                        {(displayNetWorth || 0).toLocaleString()}
                      </motion.div>
                    </motion.div>

                    {/* Condensed & Expanded Row Toggle */}
                    {!expandedCards.has(stat.id) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-1.5 text-xs font-medium text-zinc-400 mt-1 pl-12 pointer-events-none pr-2">
                        {activeSession && playerDeclarations?.[stat.id]?.status === 'active' ? (
                          <div className="flex items-center gap-3 text-zinc-500">
                            <span className="flex items-center gap-1"><Landmark className="w-3.5 h-3.5 text-zinc-600"/> {(displayBank || 0).toLocaleString()}</span>
                            <span className="opacity-40">|</span>
                            <span className="flex items-center gap-1 text-amber-200/70"><Wallet className="w-3.5 h-3.5 text-amber-500/80"/> {(displayWallet || 0).toLocaleString()}</span>
                          </div>
                        ) : activeSession && playerDeclarations?.[stat.id]?.status === 'cashed_out' ? (
                          <div className="flex items-center gap-3 text-zinc-500">
                            <span className="flex items-center gap-1 text-zinc-400" title="Bank"><Landmark className="w-3.5 h-3.5 text-zinc-600"/> {(displayBank || 0).toLocaleString()}</span>
                            <span className="opacity-40">|</span>
                            <span className="flex items-center gap-1 text-amber-300 font-medium animate-pulse" title="Pending Cashout">
                              <Hourglass className="w-3 h-3 text-amber-400" />
                              {(isInflationAdjusted ? Math.round(Number(playerDeclarations?.[stat.id]?.cashOut || 0) / (inflationRate || 1)) : Number(playerDeclarations?.[stat.id]?.cashOut || 0)).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <motion.div layoutId={`phys-box-${stat.id}`} className="flex items-center justify-start gap-1.5 truncate text-amber-100/90 rounded-lg overflow-hidden" title="Physical Balance">
                            <motion.div layoutId={`phys-icon-${stat.id}`}><Landmark className="w-3.5 h-3.5 shrink-0 text-amber-500/80" /></motion.div> 
                            <motion.span layoutId={`phys-val-${stat.id}`} className="truncate">{(displayTableBalance || 0).toLocaleString()}</motion.span>
                          </motion.div>
                        )}

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
                          const activeLoans = (loans || []).filter(l => (l.status === 'active' || l.status === 'defaulted') && (l.lender === stat.id || l.borrower === stat.id));
                          if (activeLoans.length === 0) return <motion.div layoutId={`loan-box-${stat.id}`} className="rounded-lg overflow-hidden" />;
                          const loan = activeLoans[0];
                          const isLender = loan.lender === stat.id;
                          const otherPlayerId = isLender ? loan.borrower : loan.lender;
                          const isDefaulted = loan.status === 'defaulted';
                          const color = isDefaulted ? 'text-amber-500/80' : isLender ? 'text-emerald-500/80' : 'text-rose-500/80';
                          const displayAmt = isInflationAdjusted ? Math.round(Number(loan.amount || 0) / (inflationRate || 1)) : Number(loan.amount || 0);
                          return (
                            <motion.div layoutId={`loan-box-${stat.id}`} className={`flex items-center justify-start gap-1.5 truncate rounded-lg overflow-hidden ${color}`} title="First Active Loan">
                              <motion.div layoutId={`loan-icon-${stat.id}`}><HandCoins className="w-3 h-3 shrink-0" /></motion.div> 
                              <motion.span layoutId={`loan-val-${stat.id}`} className="flex items-center truncate">
                                {(displayAmt/1000).toFixed(1).replace(/\.0$/, '')}k@{loan.interest || 0}%
                                {isLender ? <ArrowRight className="w-3 h-3 mx-0.5 shrink-0" /> : <ArrowLeft className="w-3 h-3 mx-0.5 shrink-0" />}
                                <span className="truncate">{otherPlayerId}</span>
                                {activeLoans.length > 1 && <span className="opacity-60 text-[9px] ml-0.5 shrink-0">(+{activeLoans.length - 1})</span>}
                              </motion.span>
                            </motion.div>
                          );
                        })()}

                        <motion.div layoutId={`base-box-${stat.id}`} className="flex items-center justify-end sm:justify-start gap-1.5 truncate text-sky-100/90 rounded-lg overflow-hidden" title="Baseline">
                          <motion.div layoutId={`base-icon-${stat.id}`}><Target className="w-3.5 h-3.5 shrink-0 text-sky-400/80" /></motion.div> 
                          <motion.span layoutId={`base-val-${stat.id}`} className="truncate">{(displayBaseline || 0).toLocaleString()}</motion.span>
                        </motion.div>
                      </div>
                    ) : (
                      <motion.div layout="position" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3 pointer-events-none">
                        
                        {/* Physical Balance */}
                        {(() => {
                          const isCashedOut = activeSession && playerDeclarations?.[stat.id]?.status === 'cashed_out';
                          const boxClass = isCashedOut 
                            ? "bg-amber-950/20 border border-dashed border-amber-500/40 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden"
                            : "bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden";
                          
                          return (
                            <motion.div layoutId={`phys-box-${stat.id}`} className={boxClass}>
                              {activeSession && playerDeclarations?.[stat.id]?.status === 'active' ? (
                                <div className="flex flex-col h-full justify-between gap-1 w-full">
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1">
                                    <Landmark className="w-2.5 h-2.5 text-sky-400"/> Bank & Wallet
                                  </span>
                                  <div className="flex flex-col items-center justify-center my-auto">
                                    <span className="text-xs font-semibold text-zinc-300">Bank: {(displayBank || 0).toLocaleString()}</span>
                                    <span className="text-xs font-semibold text-amber-200 mt-0.5">Wallet: {(displayWallet || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              ) : isCashedOut ? (
                                <div className="flex flex-col h-full justify-between gap-1 w-full">
                                  <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest flex items-center justify-center gap-1">
                                    <Hourglass className="w-2.5 h-2.5 text-amber-400 animate-pulse"/> Pending
                                  </span>
                                  <div className="flex flex-col items-center justify-center my-auto">
                                    <span className="text-xs font-semibold text-zinc-400">Bank: {(displayBank || 0).toLocaleString()}</span>
                                    <span className="text-xs font-semibold text-amber-300 mt-0.5 animate-pulse">
                                      Cashout: {(isInflationAdjusted ? Math.round(Number(playerDeclarations?.[stat.id]?.cashOut || 0) / (inflationRate || 1)) : Number(playerDeclarations?.[stat.id]?.cashOut || 0)).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                                    <Landmark className="w-2.5 h-2.5 text-amber-500/80"/> Physical
                                  </motion.span>
                                  <motion.div layout="position" className="text-xs font-bold text-amber-100/90 my-auto truncate">
                                    {(displayTableBalance || 0).toLocaleString()}
                                  </motion.div>
                                </>
                              )}
                            </motion.div>
                          );
                        })()}

                        {/* Net Profit / Loss */}
                        <motion.div layoutId={`pl-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            {stat.tablePL === 0 ? <Minus className="w-2.5 h-2.5" /> : stat.tablePL > 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> : <TrendingDown className="w-2.5 h-2.5 text-rose-400" />} Net P/L
                          </motion.span>
                          <motion.div layout="position" className="flex flex-col items-center justify-center my-auto">
                            <span className={`text-xs font-bold ${stat.tablePL === 0 ? 'text-zinc-400' : stat.tablePL > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {stat.tablePL > 0 ? `+${(displayTablePL || 0).toLocaleString()}` : (displayTablePL || 0).toLocaleString()}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-semibold mt-0.5">
                              {(() => {
                                const baseline = Number(stat.startBalance || 0) + Number(stat.salary || 0);
                                return baseline === 0 ? '0.0%' : `${stat.tablePL > 0 ? '+' : ''}${((stat.tablePL / baseline) * 100).toFixed(1)}%`;
                              })()}
                            </span>
                          </motion.div>
                        </motion.div>

                        {/* Active Loans Detail */}
                        <motion.div layoutId={`loan-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            <HandCoins className="w-2.5 h-2.5 text-indigo-400"/> Active Loans
                          </motion.span>
                          <motion.div layout="position" className="my-auto flex flex-col items-center justify-center">
                            {(() => {
                              const activeLoans = (loans || []).filter(l => (l.status === 'active' || l.status === 'defaulted') && (l.lender === stat.id || l.borrower === stat.id));
                              if (activeLoans.length === 0) {
                                return <motion.span layoutId={`loan-val-${stat.id}`} className="text-xs sm:text-sm font-semibold text-indigo-200/50">None</motion.span>;
                              }
                              
                              return (
                                <motion.div layoutId={`loan-val-${stat.id}`} className="flex flex-col items-center gap-0.5 animate-none">
                                  {activeLoans.map(loan => {
                                    const isLender = loan.lender === stat.id;
                                    const otherPlayerId = isLender ? loan.borrower : loan.lender;
                                    const otherPlayerName = config.players?.find(p => p.id === otherPlayerId)?.name || otherPlayerId;
                                    const displayAmt = isInflationAdjusted ? Math.round(Number(loan.amount || 0) / (inflationRate || 1)) : Number(loan.amount || 0);
                                    
                                    const isDefaulted = loan.status === 'defaulted';
                                    if (isLender) {
                                      return (
                                        <motion.div layout="position" key={loan.id} className={`text-xs sm:text-sm font-medium leading-tight flex items-center gap-1 ${isDefaulted ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>
                                          {isDefaulted && <span className="text-[8px] font-bold bg-amber-500/20 text-amber-400 px-1 rounded uppercase tracking-wide">defaulted</span>}
                                          lent {(displayAmt || 0).toLocaleString()}@{loan.interest || 0}% to {otherPlayerName}
                                        </motion.div>
                                      );
                                    } else {
                                      return (
                                        <motion.div layout="position" key={loan.id} className={`text-xs sm:text-sm font-medium leading-tight flex items-center gap-1 ${isDefaulted ? 'text-amber-400/80' : 'text-rose-400/80'}`}>
                                          {isDefaulted && <span className="text-[8px] font-bold bg-amber-500/20 text-amber-400 px-1 rounded uppercase tracking-wide">defaulted</span>}
                                          borrowed {(displayAmt || 0).toLocaleString()}@{loan.interest || 0}% from {otherPlayerName}
                                        </motion.div>
                                      );
                                    }
                                  })}
                                </motion.div>
                              );
                            })()}
                          </motion.div>
                        </motion.div>

                        {/* Baseline Target */}
                        <motion.div layoutId={`base-box-${stat.id}`} className="bg-black/20 border border-white/5 rounded-lg py-1.5 px-2 flex flex-col h-full text-center overflow-hidden">
                          <motion.span layout="position" className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-1 min-h-[14px]">
                            <Target className="w-2.5 h-2.5 text-sky-400"/> Baseline
                          </motion.span>
                          <motion.div layout="position" className="flex flex-col items-center justify-center my-auto">
                            <motion.span layoutId={`base-val-${stat.id}`} className="text-xs font-bold text-sky-100/90">
                              {(displayBaseline || 0).toLocaleString()}
                            </motion.span>
                            <div className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500 mt-0.5">
                              <motion.span layout="position">{(displayStartBalance || 0).toLocaleString()} START</motion.span>
                              <span>+</span>
                              <motion.span layout="position" className="text-sky-300/70">{(displaySalary || 0).toLocaleString()} PAY</motion.span>
                            </div>
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
