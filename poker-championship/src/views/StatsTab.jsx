import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  TrendingUp, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Calendar,
  HelpCircle,
  Coins
} from 'lucide-react';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#84cc16', // lime
  '#a855f7', // purple
];

function HeaderTooltip({ label, desc, calc, align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isOpen]);

  return (
    <div 
      ref={containerRef}
      className="inline-flex items-center relative normal-case"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="text-zinc-600 hover:text-zinc-400 p-0.5 rounded transition-colors cursor-pointer ml-1 inline-flex items-center justify-center shrink-0"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      
      {isOpen && (
        <div 
          className={`absolute top-full mt-2 z-50 w-64 p-3 bg-zinc-955/95 border border-white/10 rounded-xl text-left shadow-2xl text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-1 normal-case font-medium text-zinc-300 pointer-events-none ${
            align === 'left' ? 'left-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
          }`}
        >
          <div className="font-bold text-white mb-1">{label}</div>
          <div className="text-zinc-400 text-[11px] leading-relaxed">{desc}</div>
          {calc && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-0.5">Calculation</span>
              <code className="text-[10px] font-mono text-zinc-300 bg-black/40 px-1 py-0.5 rounded block whitespace-normal break-words leading-tight">{calc}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Bezier path generator for smooth curve interpolation (tension 0.2)
const getBezierPath = (points, tension = 0.2) => {
  if (points.length < 2) return '';
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path;
};

// Sparkline builder for table rows
const getSparklinePath = (history) => {
  if (history.length < 2) return '';
  const spW = 100;
  const spH = 26;
  const spDays = history.map(h => h.dayNumber);
  const spProfits = history.map(h => h.profit);
  const spMinD = 0;
  const spMaxD = Math.max(...spDays, 1);
  const spMinP = Math.min(...spProfits, 0);
  const spMaxP = Math.max(...spProfits, 100);
  const spPDiff = spMaxP - spMinP || 1;

  const points = history.map(h => {
    const x = ((h.dayNumber - spMinD) / (spMaxD - spMinD)) * spW;
    const y = spH - ((h.profit - spMinP) / spPDiff) * spH;
    return { x, y };
  });

  return getBezierPath(points, 0.2);
};

export default function StatsTab({ config, sessions, loans }) {
  // Sorting state for the data table
  const [sortField, setSortField] = useState('netProfit');
  const [sortDirection, setSortDirection] = useState('desc');

  // Chart visibility state
  const [visiblePlayers, setVisiblePlayers] = useState({});
  const [hoveredDay, setHoveredDay] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Economy chart state
  const [hoveredEcoDay, setHoveredEcoDay] = useState(null);
  const [ecoMousePos, setEcoMousePos] = useState({ x: 0, y: 0 });

  // 1. Process Completed Sessions
  const completedSessions = useMemo(() => {
    return sessions
      .filter(s => s.status !== 'active')
      .sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber));
  }, [sessions]);

  // List of all completed day numbers
  const allDays = useMemo(() => {
    return [0, ...completedSessions.map(s => Number(s.dayNumber))];
  }, [completedSessions]);

  // Economy & Inflation stats
  const economyStats = useMemo(() => {
    // 1. Calculate Day 0 Money Supply
    const startSupply = config.players.reduce((sum, p) => sum + Number(p.startBalance || 0), 0);
    if (startSupply === 0) return null;

    const history = [];

    // Day 0
    history.push({
      dayNumber: 0,
      moneySupply: startSupply,
      inflationRate: 1.0,
      paydaysDistributed: 0,
      cumulativePaydays: 0,
    });

    let cumulativePaydays = 0;

    completedSessions.forEach((s) => {
      const day = Number(s.dayNumber);
      
      // Sum of balances on this day
      let daySupply = 0;
      config.players.forEach(p => {
        const balVal = s.balances?.[p.id];
        let bal = 0;
        if (balVal !== undefined && balVal !== null) {
          if (typeof balVal === 'object') {
            bal = Number(balVal.bank || 0) + Number(balVal.wallet || 0);
          } else {
            bal = Number(balVal);
          }
        } else {
          bal = Number(p.startBalance || 0);
        }
        daySupply += bal;
      });

      // Sum of paydays distributed on this day
      let dayPaydays = 0;
      if (s.paydaysDistributed) {
        Object.values(s.paydaysDistributed).forEach(val => {
          dayPaydays += Number(val || 0);
        });
      }
      cumulativePaydays += dayPaydays;

      history.push({
        dayNumber: day,
        moneySupply: daySupply,
        inflationRate: daySupply / startSupply,
        paydaysDistributed: dayPaydays,
        cumulativePaydays: cumulativePaydays,
      });
    });

    const latest = history[history.length - 1];

    return {
      startSupply,
      currentSupply: latest ? latest.moneySupply : startSupply,
      currentInflationRate: latest ? latest.inflationRate : 1.0,
      totalPaydays: latest ? latest.cumulativePaydays : 0,
      history,
    };
  }, [config.players, completedSessions]);

  // Economy chart setup
  const ecoWidth = 800;
  const ecoHeight = 200;
  const ecoMargin = { top: 20, right: 30, bottom: 30, left: 60 };

  const ecoXMin = 0;
  const ecoXMax = Math.max(...allDays, 1);

  const ecoValues = useMemo(() => {
    return economyStats ? economyStats.history.map(h => h.moneySupply) : [0];
  }, [economyStats]);

  const ecoMinVal = useMemo(() => {
    const minVal = Math.min(...ecoValues, economyStats?.startSupply || 0);
    return minVal * 0.95; // 5% padding below
  }, [ecoValues, economyStats]);

  const ecoMaxVal = useMemo(() => {
    const maxVal = Math.max(...ecoValues, economyStats?.startSupply || 100);
    return maxVal * 1.05; // 5% padding above
  }, [ecoValues, economyStats]);

  const ecoValDiff = useMemo(() => {
    return (ecoMaxVal - ecoMinVal) || 1;
  }, [ecoMaxVal, ecoMinVal]);

  const getEcoX = (day) => {
    const range = ecoXMax - ecoXMin;
    const width = ecoWidth - ecoMargin.left - ecoMargin.right;
    return ecoMargin.left + ((day - ecoXMin) / range) * width;
  };

  const getEcoY = (val) => {
    const height = ecoHeight - ecoMargin.top - ecoMargin.bottom;
    return ecoHeight - ecoMargin.bottom - ((val - ecoMinVal) / ecoValDiff) * height;
  };

  const ecoPoints = useMemo(() => {
    return economyStats ? economyStats.history.map(h => ({ x: getEcoX(h.dayNumber), y: getEcoY(h.moneySupply) })) : [];
  }, [economyStats, ecoMinVal, ecoMaxVal, ecoValDiff]);

  const ecoLinePath = useMemo(() => {
    return ecoPoints.length > 0 ? getBezierPath(ecoPoints, 0.2) : '';
  }, [ecoPoints]);

  const areaPath = useMemo(() => {
    if (ecoPoints.length === 0) return '';
    return `
      M ${ecoPoints[0].x} ${ecoHeight - ecoMargin.bottom}
      L ${ecoPoints[0].x} ${ecoPoints[0].y}
      ${ecoLinePath.substring(1)}
      L ${ecoPoints[ecoPoints.length - 1].x} ${ecoHeight - ecoMargin.bottom}
      Z
    `;
  }, [ecoPoints, ecoLinePath]);

  const ecoTicks = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => {
      return ecoMinVal + (i / 4) * (ecoMaxVal - ecoMinVal);
    });
  }, [ecoMinVal, ecoMaxVal]);

  const handleEcoMouseMove = (e) => {
    if (!economyStats || economyStats.history.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const width = ecoWidth - ecoMargin.left - ecoMargin.right;
    const range = ecoXMax - ecoXMin;
    
    const xRatio = (x - ecoMargin.left) / width;
    const rawDay = ecoXMin + xRatio * range;

    let closestDay = allDays[0];
    let minDiff = Math.abs(rawDay - closestDay);
    allDays.forEach(day => {
      const diff = Math.abs(rawDay - day);
      if (diff < minDiff) {
        minDiff = diff;
        closestDay = day;
      }
    });

    setHoveredEcoDay(closestDay);
    setEcoMousePos({ x: x + 15, y: y - 10 });
  };

  const handleEcoMouseLeave = () => {
    setHoveredEcoDay(null);
  };

  // 2. Aggregate Stats per Player
  const playerStats = useMemo(() => {
    const statsMap = {};

    // Initialize map
    config.players.forEach(p => {
      statsMap[p.id] = {
        id: p.id,
        name: p.name,
        totalSessions: 0,
        ledgerSessionsCount: 0,
        netProfit: 0,
        netProfitOfLedgerSessions: 0,
        totalVolume: 0,
        wins: 0,
        bustOuts: 0,
        bestSwing: -Infinity,
        worstSwing: Infinity,
        currentWinStreak: 0,
        currentLossStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
        history: [{ dayNumber: 0, profit: 0 }],
        loansBorrowedOnPlayDays: 0
      };
    });

    // Process sessions chronologically
    completedSessions.forEach((s, index) => {
      const day = Number(s.dayNumber);

      config.players.forEach(p => {
        const playerStats = statsMap[p.id];
        const playRecord = s.ledger?.[p.id];
        const hasLedger = s.ledger && Object.keys(s.ledger).length > 0;

        // Calculate paydays distributed up to this day
        let paydaysUpToDay = 0;
        completedSessions.forEach(session => {
          if (Number(session.dayNumber) <= day) {
            paydaysUpToDay += Number(session.paydaysDistributed?.[p.id] || 0);
          }
        });

        // Calculate active loan principal for borrower and lender at the end of this day
        let borrowedPrincipalD = 0;
        let lentOutPrincipalD = 0;
        loans.forEach(loan => {
          if (!['active', 'pending_settlement', 'settled'].includes(loan.status)) return;
          if (Number(loan.dayIssued) > day) return;
          const settledDay = loan.settledDay !== undefined && loan.settledDay !== null && loan.settledDay !== '' ? Number(loan.settledDay) : Number(loan.dayIssued);
          if (loan.status === 'settled' && settledDay <= day) return;

          const principal = Number(loan.amount);
          if (loan.borrower === p.id) borrowedPrincipalD += principal;
          if (loan.lender === p.id) lentOutPrincipalD += principal;
        });

        const currentBalVal = s.balances?.[p.id];
        let currentBal = 0;
        if (currentBalVal !== undefined && currentBalVal !== null) {
          if (typeof currentBalVal === 'object') {
            currentBal = Number(currentBalVal.bank || 0) + Number(currentBalVal.wallet || 0);
          } else {
            currentBal = Number(currentBalVal);
          }
        } else {
          currentBal = Number(p.startBalance || 0);
        }
        const expectedBreakEvenD = Number(p.startBalance || 0) + paydaysUpToDay;
        const cumulativeProfitD = (currentBal - borrowedPrincipalD + lentOutPrincipalD) - expectedBreakEvenD;

        const prevProfit = playerStats.history[playerStats.history.length - 1].profit;
        const net = cumulativeProfitD - prevProfit;

        let played = false;

        if (playRecord) {
          const buyIn = Number(playRecord.buyIn || 0);
          const rebuys = Number(playRecord.rebuys || 0);
          const cashOut = Number(playRecord.cashOut || 0);
          const volume = buyIn + rebuys;
          const ledgerNet = cashOut - volume;
          played = true;

          playerStats.totalVolume += volume;
          playerStats.ledgerSessionsCount += 1;
          playerStats.netProfitOfLedgerSessions += ledgerNet;
          if (cashOut === 0) playerStats.bustOuts += 1;

          // Loans calculation on played days
          const dayLoans = loans.filter(l => 
            Number(l.dayIssued) === day && 
            l.borrower === p.id && 
            ['active', 'settled', 'pending_settlement'].includes(l.status)
          );
          const borrowedToday = dayLoans.reduce((sum, l) => sum + Number(l.amount || 0), 0);
          playerStats.loansBorrowedOnPlayDays += borrowedToday;
        } else if (!hasLedger) {
          // Fallback to balance differential for older/manually-entered sessions only
          if (net !== 0) {
            played = true;
          }
        }

        if (played) {
          playerStats.totalSessions += 1;
          playerStats.bestSwing = Math.max(playerStats.bestSwing, net);
          playerStats.worstSwing = Math.min(playerStats.worstSwing, net);

          if (net > 0) playerStats.wins += 1;

          // Streaks
          if (net > 0) {
            playerStats.currentWinStreak += 1;
            playerStats.currentLossStreak = 0;
            playerStats.maxWinStreak = Math.max(playerStats.maxWinStreak, playerStats.currentWinStreak);
          } else if (net < 0) {
            playerStats.currentLossStreak += 1;
            playerStats.currentWinStreak = 0;
            playerStats.maxLossStreak = Math.max(playerStats.maxLossStreak, playerStats.currentLossStreak);
          } else {
            // Push breaks streaks
            playerStats.currentWinStreak = 0;
            playerStats.currentLossStreak = 0;
          }
        }

        // Always update netProfit to the latest cumulative profit
        playerStats.netProfit = cumulativeProfitD;

        // Push history point (flat if didn't play)
        playerStats.history.push({
          dayNumber: day,
          profit: cumulativeProfitD
        });
      });
    });

    // Derive rates and clean defaults
    return Object.values(statsMap).map((ps, idx) => {
      const best = ps.bestSwing === -Infinity ? 0 : ps.bestSwing;
      const worst = ps.worstSwing === Infinity ? 0 : ps.worstSwing;
      const winRate = ps.totalSessions > 0 ? (ps.wins / ps.totalSessions) * 100 : 0;
      const avgProfit = ps.totalSessions > 0 ? (ps.netProfit / ps.totalSessions) : 0;

      // Null out volume-dependent stats for players/sessions without ledger records
      const hasLedger = ps.ledgerSessionsCount > 0;
      const totalVolume = hasLedger ? ps.totalVolume : null;
      const roi = hasLedger && ps.totalVolume > 0 ? (ps.netProfitOfLedgerSessions / ps.totalVolume) * 100 : null;
      const bustOutRate = hasLedger ? (ps.bustOuts / ps.ledgerSessionsCount) * 100 : null;
      const loanDependency = hasLedger && ps.totalVolume > 0 ? Math.min(100, (ps.loansBorrowedOnPlayDays / ps.totalVolume) * 100) : null;

      // Current Streak string representation
      let currentStreakStr = '-';
      if (ps.currentWinStreak > 0) currentStreakStr = `W${ps.currentWinStreak}`;
      else if (ps.currentLossStreak > 0) currentStreakStr = `L${ps.currentLossStreak}`;

      return {
        ...ps,
        color: COLORS[idx % COLORS.length],
        bestSwing: best,
        worstSwing: worst,
        winRate,
        roi,
        avgProfit,
        bustOutRate,
        loanDependency,
        currentStreakStr,
        longestStreakStr: `W${ps.maxWinStreak} / L${ps.maxLossStreak}`
      };
    });
  }, [config.players, completedSessions, loans]);

  // 3. Initialize default chart visibility (top 3 players by Net Profit)
  useMemo(() => {
    if (Object.keys(visiblePlayers).length > 0 || playerStats.length === 0) return;
    const sorted = [...playerStats].sort((a, b) => b.netProfit - a.netProfit);
    const defaults = {};
    sorted.forEach((ps, idx) => {
      defaults[ps.id] = idx < 3;
    });
    setVisiblePlayers(defaults);
  }, [playerStats]);

  // Toggle visible players
  const handleTogglePlayerVisibility = (id) => {
    setVisiblePlayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Sort helper
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sorted list of players
  const sortedPlayers = useMemo(() => {
    return [...playerStats].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle null values (older data without ledger records) by placing them at the bottom of the table
      if (valA === null && valB === null) return 0;
      if (valA === null) return 1;
      if (valB === null) return -1;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [playerStats, sortField, sortDirection]);

  // ── Chart Dimensions & SVG Scaling ───────────────────────────────────────────
  const chartWidth = 800;
  const chartHeight = 350;
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };

  const minDay = 0;
  const maxDay = Math.max(...allDays, 1);

  // Find overall min/max profits for Y axis
  const { yMin, yMax } = useMemo(() => {
    const activeIds = Object.keys(visiblePlayers).filter(id => visiblePlayers[id]);
    const activeHistories = playerStats
      .filter(ps => activeIds.includes(ps.id))
      .flatMap(ps => ps.history.map(h => h.profit));

    const min = activeHistories.length > 0 ? Math.min(...activeHistories, 0) : -5000;
    const max = activeHistories.length > 0 ? Math.max(...activeHistories, 5000) : 5000;
    const padding = (max - min) * 0.1 || 1000;
    return { yMin: min - padding, yMax: max + padding };
  }, [playerStats, visiblePlayers]);

  // Scaling helpers
  const getX = (day) => {
    return margin.left + ((day - minDay) / (maxDay - minDay)) * (chartWidth - margin.left - margin.right);
  };
  const getY = (val) => {
    return chartHeight - margin.bottom - ((val - yMin) / (yMax - yMin)) * (chartHeight - margin.top - margin.bottom);
  };



  // Handle chart hover
  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale back SVG width to actual pixel coordinates
    const scaleX = chartWidth / rect.width;
    const scaleY = chartHeight / rect.height;
    const svgX = x * scaleX;
    const svgY = y * scaleY;

    // Find closest Day number
    let closestDay = 0;
    let minDistance = Infinity;

    allDays.forEach(day => {
      const dayX = getX(day);
      const dist = Math.abs(dayX - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestDay = day;
      }
    });

    // Don't trigger if cursor is outside left/right margins
    if (svgX < margin.left - 10 || svgX > chartWidth - margin.right + 10) {
      setHoveredDay(null);
    } else {
      setHoveredDay(closestDay);
      setMousePos({ x: x + 15, y: y - 10 });
    }
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  // Get list of players and profits at hovered day
  const hoverStats = useMemo(() => {
    if (hoveredDay === null) return [];
    return playerStats
      .filter(ps => visiblePlayers[ps.id])
      .map(ps => {
        const point = ps.history.find(h => h.dayNumber === hoveredDay);
        return {
          name: ps.name,
          profit: point ? point.profit : ps.netProfit,
          color: ps.color
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [hoveredDay, playerStats, visiblePlayers]);

  if (completedSessions.length === 0) {
    return (
      <div className="text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed">
        <TrendingUp className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-zinc-300">No Stats Available</h3>
        <p className="text-zinc-500 text-sm mt-1">Complete and commit at least one daily session in the Daily Ledger tab to unlock visual trends and advanced metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" /> Advanced Game Analytics
        </h2>
        <p className="text-sm text-zinc-500">Comprehensive statistics, profit trends, and session performance tracking.</p>
      </div>

      {/* ── Main Chart Section ────────────────────────────────────────────────── */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 sm:p-6 shadow-xl relative">
        <h3 className="text-sm uppercase font-bold text-zinc-400 tracking-wider mb-4">Bankroll Growth Trendline</h3>
        
        {/* Tooltip Overlay */}
        {hoveredDay !== null && hoverStats.length > 0 && (
          <div 
            className="absolute z-50 bg-[#09090b]/95 border border-white/10 rounded-xl p-3 shadow-2xl text-xs pointer-events-none flex flex-col gap-1.5 min-w-[150px] backdrop-blur-md"
            style={{ left: mousePos.x, top: mousePos.y }}
          >
            <div className="font-bold border-b border-white/10 pb-1 text-zinc-400 flex justify-between">
              <span>Day {hoveredDay}</span>
              <span className="font-mono">Cumulative</span>
            </div>
            <div className="space-y-1">
              {hoverStats.map(hs => (
                <div key={hs.name} className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hs.color }} />
                    <span className="text-zinc-300 font-medium">{hs.name}</span>
                  </div>
                  <span className={`font-mono font-bold ${hs.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {hs.profit >= 0 ? '+' : ''}{hs.profit.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SVG Graphic Canvas */}
        <div className="relative aspect-[8/3.5] w-full min-h-[220px]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-full overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >


            {/* Grid Lines */}
            {Array.from({ length: 5 }).map((_, i) => {
              const val = yMin + (i / 4) * (yMax - yMin);
              const y = getY(val);
              return (
                <g key={`grid-y-${i}`}>
                  <line 
                    x1={margin.left} 
                    y1={y} 
                    x2={chartWidth - margin.right} 
                    y2={y} 
                    stroke="rgba(255,255,255,0.03)" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={margin.left - 10} 
                    y={y + 4} 
                    textAnchor="end" 
                    className="font-mono text-[9px] fill-zinc-600 font-semibold"
                  >
                    {val >= 0 ? '+' : ''}{Math.round(val).toLocaleString()}
                  </text>
                </g>
              );
            })}

            {/* X-Axis labels */}
            {allDays.map(day => {
              const x = getX(day);
              return (
                <g key={`lbl-x-${day}`}>
                  <line 
                    x1={x} 
                    y1={margin.top} 
                    x2={x} 
                    y2={chartHeight - margin.bottom} 
                    stroke="rgba(255,255,255,0.02)" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={x} 
                    y={chartHeight - margin.bottom + 18} 
                    textAnchor="middle" 
                    className="font-mono text-[9px] fill-zinc-600 font-bold"
                  >
                    D{day}
                  </text>
                </g>
              );
            })}

            {/* Trendlines */}
            {playerStats.map(ps => {
              if (!visiblePlayers[ps.id]) return null;

              // Generate line path coordinates using smooth bezier curve
              const points = ps.history.map(h => ({ x: getX(h.dayNumber), y: getY(h.profit) }));
              const linePath = getBezierPath(points, 0.2);

              return (
                <g key={`line-group-${ps.id}`}>
                  {/* Main Stroke Line */}
                  <path 
                    d={linePath} 
                    fill="none" 
                    stroke={ps.color} 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Hover guideline and indicator markers */}
            {hoveredDay !== null && (
              <g>
                <line
                  x1={getX(hoveredDay)}
                  y1={margin.top}
                  x2={getX(hoveredDay)}
                  y2={chartHeight - margin.bottom}
                  stroke="rgba(255,255,255,0.2)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                {playerStats.map(ps => {
                  if (!visiblePlayers[ps.id]) return null;
                  const point = ps.history.find(h => h.dayNumber === hoveredDay);
                  if (!point) return null;
                  return (
                    <circle
                      key={`dot-${ps.id}`}
                      cx={getX(hoveredDay)}
                      cy={getY(point.profit)}
                      r="4"
                      fill={ps.color}
                      stroke="#09090b"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            )}
          </svg>
        </div>

        {/* Legend Filter Toggles */}
        <div className="flex flex-wrap gap-2.5 mt-5 border-t border-white/5 pt-5">
          {playerStats.map(ps => {
            const isVisible = visiblePlayers[ps.id];
            return (
              <button
                key={`legend-${ps.id}`}
                onClick={() => handleTogglePlayerVisibility(ps.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                  isVisible
                    ? 'bg-zinc-950 border-white/10 text-white'
                    : 'bg-transparent border-white/5 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span 
                  className={`w-2 h-2 rounded-full transition-transform ${isVisible ? 'scale-110' : 'scale-90 opacity-40'}`} 
                  style={{ backgroundColor: ps.color }} 
                />
                <span>{ps.name}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  ({ps.netProfit >= 0 ? '+' : ''}{ps.netProfit.toLocaleString()})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Economy & Inflation Section ───────────────────────────────────────── */}
      {economyStats && (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 sm:p-6 shadow-xl space-y-6 relative">
          <div>
            <h3 className="text-sm uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" /> League Economy & Inflation
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Tracks overall money supply growth, currency injection, and system-wide inflation relative to Day 0 baseline.</p>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Current Money Supply</span>
              <span className="text-lg font-bold text-white font-mono">{economyStats.currentSupply.toLocaleString()} <span className="text-[10px] text-zinc-500">chips</span></span>
            </div>
            <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Day 0 Money Supply</span>
              <span className="text-lg font-bold text-zinc-400 font-mono">{economyStats.startSupply.toLocaleString()} <span className="text-[10px] text-zinc-500">chips</span></span>
            </div>
            <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Inflation Rate</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-lg font-bold text-amber-400 font-mono">{economyStats.currentInflationRate.toFixed(2)}x</span>
                {economyStats.currentInflationRate > 1 && (
                  <span className="text-[9px] font-bold text-emerald-400 flex items-center bg-emerald-500/10 px-1.5 py-0.5 rounded leading-none">
                    <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
                    +{((economyStats.currentInflationRate - 1) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">Total Injected Paydays</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">+{economyStats.totalPaydays.toLocaleString()} <span className="text-[10px] text-zinc-500">chips</span></span>
            </div>
          </div>

          {/* Line Chart */}
          <div className="relative aspect-[8/3.5] w-full min-h-[220px] bg-zinc-950/20 border border-white/5 rounded-2xl p-4">
            
            {/* Tooltip Overlay */}
            {hoveredEcoDay !== null && (() => {
              const point = economyStats.history.find(h => h.dayNumber === hoveredEcoDay);
              if (!point) return null;
              return (
                <div 
                  className="absolute z-50 bg-[#09090b]/95 border border-white/10 rounded-xl p-3 shadow-2xl text-xs pointer-events-none flex flex-col gap-1.5 min-w-[170px] backdrop-blur-md"
                  style={{ left: ecoMousePos.x, top: ecoMousePos.y }}
                >
                  <div className="font-bold border-b border-white/10 pb-1 text-zinc-400 flex justify-between">
                    <span>Day {hoveredEcoDay}</span>
                    <span className="font-mono text-amber-400">{(point.inflationRate).toFixed(2)}x</span>
                  </div>
                  <div className="space-y-1 text-zinc-300">
                    <div className="flex justify-between gap-4">
                      <span>Money Supply:</span>
                      <span className="font-mono font-bold text-white">{point.moneySupply.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Paydays (Day):</span>
                      <span className="font-mono text-emerald-400">+{point.paydaysDistributed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Total Paydays:</span>
                      <span className="font-mono text-emerald-500">+{point.cumulativePaydays.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SVG Graphic Canvas */}
            <div className="w-full h-full">
              <svg
                viewBox={`0 0 ${ecoWidth} ${ecoHeight}`}
                className="w-full h-full overflow-visible"
                onMouseMove={handleEcoMouseMove}
                onMouseLeave={handleEcoMouseLeave}
              >
                <defs>
                  <linearGradient id="ecoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid Lines */}
                {ecoTicks.map((val, i) => {
                  const y = getEcoY(val);
                  return (
                    <g key={`eco-grid-y-${i}`}>
                      <line 
                        x1={ecoMargin.left} 
                        y1={y} 
                        x2={ecoWidth - ecoMargin.right} 
                        y2={y} 
                        stroke="rgba(255,255,255,0.03)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={ecoMargin.left - 10} 
                        y={y + 4} 
                        textAnchor="end" 
                        className="font-mono text-[9px] fill-zinc-600 font-semibold"
                      >
                        {(val / 1000).toFixed(1).replace(/\.0$/, '')}k
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis labels */}
                {allDays.map(day => {
                  const x = getEcoX(day);
                  return (
                    <g key={`eco-lbl-x-${day}`}>
                      <line 
                        x1={x} 
                        y1={ecoMargin.top} 
                        x2={x} 
                        y2={ecoHeight - ecoMargin.bottom} 
                        stroke="rgba(255,255,255,0.02)" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={x} 
                        y={ecoHeight - ecoMargin.bottom + 18} 
                        textAnchor="middle" 
                        className="font-mono text-[9px] fill-zinc-600 font-bold"
                      >
                        D{day}
                      </text>
                    </g>
                  );
                })}

                {/* Area Fill */}
                {areaPath && (
                  <path 
                    d={areaPath} 
                    fill="url(#ecoGradient)" 
                  />
                )}

                {/* Line Path */}
                {ecoLinePath && (
                  <path 
                    d={ecoLinePath} 
                    fill="none" 
                    stroke="#f59e0b" 
                    strokeWidth="3" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Dots on points */}
                {economyStats.history.map(h => (
                  <circle
                    key={`eco-point-dot-${h.dayNumber}`}
                    cx={getEcoX(h.dayNumber)}
                    cy={getEcoY(h.moneySupply)}
                    r="3"
                    fill="#09090b"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                ))}

                {/* Hover line and cursor marker */}
                {hoveredEcoDay !== null && (() => {
                  const point = economyStats.history.find(h => h.dayNumber === hoveredEcoDay);
                  if (!point) return null;
                  return (
                    <g>
                      <line
                        x1={getEcoX(hoveredEcoDay)}
                        y1={ecoMargin.top}
                        x2={getEcoX(hoveredEcoDay)}
                        y2={ecoHeight - ecoMargin.bottom}
                        stroke="rgba(245, 158, 11, 0.3)"
                        strokeDasharray="4 4"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={getEcoX(hoveredEcoDay)}
                        cy={getEcoY(point.moneySupply)}
                        r="5.5"
                        fill="#f59e0b"
                        stroke="#09090b"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })()}

              </svg>
            </div>

          </div>
        </div>
      )}

      {/* ── Sortable Roster Stats Table ───────────────────────────────────────── */}
      <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col space-y-6 overflow-hidden">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-white">Roster Aggregates</h3>
            <p className="text-xs text-zinc-500">Comprehensive metrics sorted by performance. Click header columns to sort.</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-950 border border-white/5 px-2.5 py-1.5 rounded-lg font-mono">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>ROI & Win Rate calculate overall bankroll performance.</span>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto -mx-5 sm:-mx-6 scrollbar-thin">
          <div className="inline-block min-w-full align-middle px-5 sm:px-6">
            <div className="border border-white/5 rounded-2xl bg-zinc-950/40 overflow-hidden">
              <table className="min-w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-zinc-500 uppercase font-bold tracking-wider border-b border-white/5">
                    <th 
                      onClick={() => handleSort('name')} 
                      className="sticky left-0 bg-[#0c0c0e] p-3 text-left z-20 cursor-pointer hover:text-zinc-300 select-none min-w-[120px]"
                    >
                      <div className="flex items-center gap-1">
                        Player
                        <HeaderTooltip 
                          label="Player Info" 
                          desc="The player's name and unique ID." 
                          align="left"
                        />
                        {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />)}
                      </div>
                    </th>
                    <th className="p-3 text-center min-w-[110px]">
                      <div className="flex items-center justify-center gap-1">
                        Trend
                        <HeaderTooltip 
                          label="Bankroll Trend" 
                          desc="Visualizes the player's cumulative bankroll profit growth over time." 
                          calc="Plots cumulative profit trend across completed sessions"
                          align="center"
                        />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('netProfit')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[90px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Net Profit
                        <HeaderTooltip 
                          label="Net Profit" 
                          desc="Total cumulative profit or loss, including poker play and settled loan interest." 
                          calc="(Balance - BorrowerPrincipal + LenderPrincipal) - ExpectedBreakEven"
                          align="center"
                        />
                        {sortField === 'netProfit' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('roi')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[70px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        ROI
                        <HeaderTooltip 
                          label="Return on Investment (ROI)" 
                          desc="Poker profitability relative to buy-in volume. Only calculated for sessions with ledger records." 
                          calc="(Ledger Net Profit / Total Buy-in Volume) * 100"
                          align="center"
                        />
                        {sortField === 'roi' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('winRate')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[85px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Win Rate
                        <HeaderTooltip 
                          label="Win Rate" 
                          desc="Percentage of played sessions where the player finished with a positive net return." 
                          calc="(Sessions with profit > 0 / Total Sessions) * 100"
                          align="center"
                        />
                        {sortField === 'winRate' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('avgProfit')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[85px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Avg/Sess
                        <HeaderTooltip 
                          label="Average Profit per Session" 
                          desc="Average overall profit/loss for each session played." 
                          calc="Net Profit / Total Sessions"
                          align="center"
                        />
                        {sortField === 'avgProfit' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalVolume')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[85px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Volume
                        <HeaderTooltip 
                          label="Total Buy-in Volume" 
                          desc="Total chips bought into the game (Initial Buy-ins + Rebuys). Only calculated for sessions with ledger records." 
                          calc="Sum of (Buy-ins + Rebuys) across sessions"
                          align="center"
                        />
                        {sortField === 'totalVolume' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('bustOutRate')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[80px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Bust Rate
                        <HeaderTooltip 
                          label="Bust-out Rate" 
                          desc="Percentage of sessions where the player cashed out with 0 chips. Only calculated for sessions with ledger records." 
                          calc="(Sessions cashed out at 0 / Ledger Sessions) * 100"
                          align="center"
                        />
                        {sortField === 'bustOutRate' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th className="p-3 text-center min-w-[95px]">
                      <div className="flex items-center justify-center gap-1">
                        Streak (C/L)
                        <HeaderTooltip 
                          label="Streaks" 
                          desc="Current active win/loss streak and longest historical streaks." 
                          calc="W = consecutive wins, L = consecutive losses. Push (0 profit) breaks streaks."
                          align="center"
                        />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('loanDependency')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[85px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Loan Dep.
                        <HeaderTooltip 
                          label="Loan Dependency" 
                          desc="The portion of a player's buy-ins funded by borrowing from other players." 
                          calc="(Total Loans Borrowed on Play Days / Total Volume) * 100"
                          align="center"
                        />
                        {sortField === 'loanDependency' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                    <th className="p-3 text-right min-w-[130px]">
                      <div className="flex items-center justify-end gap-1">
                        Swings (Best/Worst)
                        <HeaderTooltip 
                          label="Swings" 
                          desc="The player's best single session win and worst single session loss." 
                          calc="Max and min net profits in a single day"
                          align="center"
                        />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('totalSessions')} 
                      className="p-3 text-right cursor-pointer hover:text-zinc-300 select-none min-w-[65px]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Played
                        <HeaderTooltip 
                          label="Sessions Played" 
                          desc="Total number of daily sessions the player participated in." 
                          calc="Count of completed days participated"
                          align="right"
                        />
                        {sortField === 'totalSessions' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedPlayers.map(ps => {
                    const sparkPath = getSparklinePath(ps.history);
                    return (
                      <tr key={ps.id} className="hover:bg-white/[0.02] transition-colors">
                        
                        {/* Sticky Name column */}
                        <td className="sticky left-0 bg-[#0c0c0e]/95 p-3 z-10 font-bold border-r border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: ps.color }} />
                            <div>
                              <span className="text-zinc-200 block text-xs">{ps.name}</span>
                              <span className="text-[9px] font-mono text-zinc-500 font-bold">ID: {ps.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Trajectory Sparkline */}
                        <td className="p-3">
                          <div className="flex justify-center items-center">
                            {sparkPath ? (
                              <svg width="100" height="26" className="overflow-visible">
                                <path
                                  d={sparkPath}
                                  fill="none"
                                  stroke={ps.color}
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                {/* End point indicator marker */}
                                {ps.history.length > 0 && (
                                  <circle
                                    cx="100"
                                    cy={26 - ((ps.netProfit - Math.min(...ps.history.map(h=>h.profit), 0)) / (Math.max(...ps.history.map(h=>h.profit), 100) - Math.min(...ps.history.map(h=>h.profit), 0) || 1)) * 26}
                                    r="2"
                                    fill={ps.color}
                                  />
                                )}
                              </svg>
                            ) : (
                              <span className="text-[9px] text-zinc-600 font-bold uppercase font-mono">No Trend</span>
                            )}
                          </div>
                        </td>

                        {/* Net Profit */}
                        <td className={`p-3 text-right font-mono font-bold text-xs ${ps.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span className="flex items-center justify-end gap-0.5">
                            {ps.netProfit >= 0 ? '+' : ''}
                            {ps.netProfit.toLocaleString()}
                            {ps.netProfit >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          </span>
                        </td>

                        {/* ROI */}
                        <td className={`p-3 text-right font-mono font-bold ${ps.roi !== null ? (ps.roi >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80') : 'text-zinc-600'}`}>
                          {ps.roi !== null ? `${ps.roi >= 0 ? '+' : ''}${ps.roi.toFixed(1)}%` : '-'}
                        </td>

                        {/* Win Rate */}
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {ps.winRate.toFixed(0)}%
                        </td>

                        {/* Avg/Sess */}
                        <td className={`p-3 text-right font-mono font-semibold ${ps.avgProfit >= 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                          {ps.avgProfit >= 0 ? '+' : ''}{Math.round(ps.avgProfit).toLocaleString()}
                        </td>

                        {/* Volume */}
                        <td className={`p-3 text-right font-mono ${ps.totalVolume !== null ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {ps.totalVolume !== null ? ps.totalVolume.toLocaleString() : '-'}
                        </td>

                        {/* Bust-out Rate */}
                        <td className={`p-3 text-right font-mono ${ps.bustOutRate !== null ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {ps.bustOutRate !== null ? `${ps.bustOutRate.toFixed(0)}%` : '-'}
                        </td>

                        {/* Streaks */}
                        <td className="p-3 text-center font-bold">
                          <div className="flex flex-col items-center">
                            <span className={`text-[10px] uppercase ${ps.currentStreakStr.startsWith('W') ? 'text-emerald-400' : ps.currentStreakStr.startsWith('L') ? 'text-rose-400' : 'text-zinc-500'}`}>
                              {ps.currentStreakStr}
                            </span>
                            <span className="text-[8px] text-zinc-600 font-bold uppercase font-mono mt-0.5">Max: {ps.longestStreakStr}</span>
                          </div>
                        </td>

                        {/* Loan Dependency */}
                        <td className={`p-3 text-right font-mono ${ps.loanDependency !== null ? (ps.loanDependency > 50 ? 'text-amber-400' : ps.loanDependency > 0 ? 'text-zinc-400' : 'text-zinc-600') : 'text-zinc-600'}`}>
                          {ps.loanDependency !== null ? `${ps.loanDependency.toFixed(0)}%` : '-'}
                        </td>

                        {/* Swings (Best / Worst) */}
                        <td className="p-3 text-right font-mono text-[10px] space-y-0.5">
                          <div className="text-emerald-400/80">+{ps.bestSwing.toLocaleString()}</div>
                          <div className="text-rose-400/80">{ps.worstSwing.toLocaleString()}</div>
                        </td>

                        {/* Played */}
                        <td className="p-3 text-right font-mono text-zinc-400">
                          {ps.totalSessions}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
