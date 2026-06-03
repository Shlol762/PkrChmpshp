import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Trophy, CalendarDays, Plus, Check, X, HandCoins, ArrowRightLeft, AlertCircle, Settings, Trash2 } from 'lucide-react';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDNHughes_fwlOts8OUaXbVb1nQN9VUfcU",
  authDomain: "pkrchmpshp.firebaseapp.com",
  projectId: "pkrchmpshp",
  storageBucket: "pkrchmpshp.firebasestorage.app",
  messagingSenderId: "300564104729",
  appId: "1:300564104729:web:90fd4a322050d38bcd0c88"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'poker-championship-app';

// ─── Default Configuration ──────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  maxSystemNW: 200 * 8300,
  salaryAmount: 3320,
  paydayInterval: 5,
  players: [
    { id: 'AD', name: 'Adi',      startBalance: 8300 },
    { id: 'AV', name: 'Advik',    startBalance: 8300 },
    { id: 'AK', name: 'Aniket',   startBalance: 8300 },
    { id: 'AS', name: 'Anish',    startBalance: 8300 },
    { id: 'AR', name: 'Anurag',   startBalance: 8300 },
    { id: 'DH', name: 'Dhruv',    startBalance: 8300 },
    { id: 'ET', name: 'Ethan',    startBalance: 8300 },
    { id: 'GV', name: 'Govind',   startBalance: 8300 },
    { id: 'LR', name: 'Leroy',    startBalance: 8300 },
    { id: 'MT', name: 'Matha',    startBalance: 8300 },
    { id: 'RD', name: 'Riddhi',   startBalance: 8300 },
    { id: 'SK', name: 'Shlok',    startBalance: 8300 },
    { id: 'SD', name: 'Sidharth', startBalance: 8300 },
    { id: 'TN', name: 'Tanav',    startBalance: 8300 },
    { id: 'VN', name: 'Vishnu',   startBalance: 8300 },
    { id: 'VG', name: 'Vignesh',  startBalance: 8300 },
  ]
};

// Helper: true repayment obligation including interest
function repaymentAmount(loan) {
  return Math.round(Number(loan.amount) * (1 + Number(loan.interest || 0) / 100));
}

export default function App() {
  const [user, setUser]           = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessions, setSessions]   = useState([]);
  const [loans, setLoans]         = useState([]);
  const [loading, setLoading]     = useState(true);

  // Configuration State
  const [config, setConfig]               = useState(DEFAULT_CONFIG);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_CONFIG);

  // Derive current day from the highest recorded day number
  const currentDay = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.max(...sessions.map(s => Number(s.dayNumber)));
  }, [sessions]);

  // Form states
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDay, setSessionDay]             = useState(1);
  const [sessionDraft, setSessionDraft]         = useState({});

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanDraft, setLoanDraft]         = useState({
    borrower: '', lender: '', amount: 0, interest: 10,
    dayIssued: 0, deadlineDay: 5,
  });

  // ── Auth ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error('Auth error:', err); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  // ── Firestore listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const configRef   = doc(db, 'artifacts', appId, 'public', 'config');
    const sessionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions');
    const loansRef    = collection(db, 'artifacts', appId, 'public', 'data', 'loans');

    const unsubConfig = onSnapshot(configRef, snap => {
      if (snap.exists()) {
        setConfig(snap.data());
        setSettingsDraft(snap.data());
      } else {
        setConfig(DEFAULT_CONFIG);
        setSettingsDraft(DEFAULT_CONFIG);
      }
    }, err => console.error('Config fetch error:', err));

    const unsubSessions = onSnapshot(sessionsRef, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => Number(b.dayNumber) - Number(a.dayNumber)); // desc
      setSessions(data);
      setLoading(false);
    }, err => console.error('Session fetch error:', err));

    const unsubLoans = onSnapshot(loansRef, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => Number(b.dayIssued) - Number(a.dayIssued));
      setLoans(data);
    }, err => console.error('Loan fetch error:', err));

    return () => { unsubConfig(); unsubSessions(); unsubLoans(); };
  }, [user]);

  // ── Core Engine ───────────────────────────────────────────────────────────────
  const getSystemStateAtDay = (dayNumber) => {
    let totalSalaryPerPlayer = 0;
    const initialChipPool = config.players.reduce((sum, p) => sum + Number(p.startBalance), 0);
    let amountInCirculation = initialChipPool;
    const numPaydays = Math.floor(dayNumber / config.paydayInterval);

    for (let i = 0; i < numPaydays; i++) {
      const paydayCost = config.players.length * config.salaryAmount;
      if (amountInCirculation + paydayCost <= config.maxSystemNW) {
        totalSalaryPerPlayer += config.salaryAmount;
        amountInCirculation += paydayCost;
      } else if (amountInCirculation < config.maxSystemNW) {
        const remaining = config.maxSystemNW - amountInCirculation;
        const partialSalary = Math.floor(remaining / config.players.length);
        totalSalaryPerPlayer += partialSalary;
        amountInCirculation += partialSalary * config.players.length;
        break;
      } else {
        break;
      }
    }
    return { totalSalaryPerPlayer, amountInCirculation };
  };

  const playerStats = useMemo(() => {
    const latestSession = sessions.length > 0 ? sessions[0] : null;
    const { totalSalaryPerPlayer } = getSystemStateAtDay(currentDay);

    return config.players.map(player => {
      const currentTableBalance =
        latestSession?.balances?.[player.id] !== undefined
          ? Number(latestSession.balances[player.id])
          : Number(player.startBalance);

      const expectedBreakEven = Number(player.startBalance) + totalSalaryPerPlayer;
      const tablePL = currentTableBalance - expectedBreakEven;

      let lentOut  = 0;
      let borrowed = 0;
      loans.forEach(loan => {
        if (loan.status !== 'active') return;
        const repay = repaymentAmount(loan);
        if (loan.lender   === player.id) lentOut  += repay;
        if (loan.borrower === player.id) borrowed += repay;
      });

      const netWorth = currentTableBalance + lentOut - borrowed;

      return {
        ...player,
        currentTableBalance,
        tablePL,
        salary: totalSalaryPerPlayer,
        lentOut,
        borrowed,
        netWorth
      };
    }).sort((a, b) => b.netWorth - a.netWorth);
  }, [sessions, loans, currentDay, config]);

  // ── Derived UI values ─────────────────────────────────────────────────────────
  const actualSystemNetWorth = playerStats.reduce((sum, p) => sum + p.netWorth, 0);
  const salaryPerPlayer = playerStats[0]?.salary || 0;
  const totalPaydays    = Math.floor(currentDay / config.paydayInterval);
  const nextPaydayIn    = config.paydayInterval - (currentDay % config.paydayInterval);

  // ── Settings Actions ──────────────────────────────────────────────────────────
  const handleConfigChange = (field, value) => {
    setSettingsDraft(prev => ({ ...prev, [field]: Number(value) }));
  };

  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...settingsDraft.players];
    newPlayers[index] = { 
      ...newPlayers[index], 
      [field]: field === 'startBalance' ? Number(value) : value 
    };
    setSettingsDraft(prev => ({ ...prev, players: newPlayers }));
  };

  const addPlayer = () => {
    const newId = Math.random().toString(36).substr(2, 4).toUpperCase();
    setSettingsDraft(prev => ({
      ...prev,
      players: [...prev.players, { id: newId, name: 'New Player', startBalance: 8300 }]
    }));
  };

  const removePlayer = (index) => {
    if (window.confirm("Warning: Removing a player might cause errors if they have existing records in sessions or loans. Proceed?")) {
      const newPlayers = settingsDraft.players.filter((_, i) => i !== index);
      setSettingsDraft(prev => ({ ...prev, players: newPlayers }));
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'config'), settingsDraft);
      alert("Settings saved successfully!");
    } catch (err) { console.error("Error saving config:", err); }
  };

  // ── Session actions ───────────────────────────────────────────────────────────
  const openSessionModal = () => {
    const latestSession = sessions.length > 0 ? sessions[0] : null;
    const nextDay = currentDay + 1;
    
    const currentState = getSystemStateAtDay(currentDay);
    const nextState = getSystemStateAtDay(nextDay);
    const salaryBump = nextState.totalSalaryPerPlayer - currentState.totalSalaryPerPlayer;

    const draft = {};
    config.players.forEach(p => {
      const lastKnownBalance = latestSession?.balances?.[p.id] ?? Number(p.startBalance);
      draft[p.id] = lastKnownBalance + salaryBump;
    });

    setSessionDraft(draft);
    setSessionDay(nextDay);
    setShowSessionModal(true);
  };

  const handleSessionDraftChange = (playerId, val) => {
    setSessionDraft(prev => ({ ...prev, [playerId]: val === '' ? '' : Number(val) }));
  };

  const saveSession = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), {
        dayNumber:   Number(sessionDay),
        balances:    sessionDraft,
        recordedAt:  new Date().toISOString(),
        recordedBy:  user.uid,
      });
      setShowSessionModal(false);
    } catch (err) { console.error('Error saving session:', err); }
  };

  const deleteSession = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', id));
    } catch (err) { console.error('Error deleting session:', err); }
  };

  // ── Loan actions ──────────────────────────────────────────────────────────────
  const openLoanModal = () => {
    setLoanDraft({
      borrower: '', lender: '', amount: 0, interest: 10,
      dayIssued: currentDay, deadlineDay: currentDay + 5,
    });
    setShowLoanModal(true);
  };

  const saveLoan = async () => {
    if (!user || !loanDraft.borrower || !loanDraft.lender || loanDraft.amount <= 0) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
        ...loanDraft,
        status:      'active',
        recordedAt:  new Date().toISOString(),
        recordedBy:  user.uid,
      });
      setShowLoanModal(false);
    } catch (err) { console.error('Error saving loan:', err); }
  };

  const toggleLoanStatus = async (loan) => {
    if (!user) return;
    try {
      const isSettling = loan.status === 'active';
      const repayAmount = repaymentAmount(loan);

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', loan.id), {
        status:     isSettling ? 'settled' : 'active',
        settledDay: isSettling ? currentDay : null,
      });

      if (sessions.length > 0) {
        const latestSession = sessions[0];
        const newBalances = { ...latestSession.balances };

        const borrowerBal = newBalances[loan.borrower] ?? Number(config.players.find(p=>p.id===loan.borrower)?.startBalance || 0);
        const lenderBal   = newBalances[loan.lender] ?? Number(config.players.find(p=>p.id===loan.lender)?.startBalance || 0);

        if (isSettling) {
          newBalances[loan.borrower] = borrowerBal - repayAmount;
          newBalances[loan.lender]   = lenderBal + repayAmount;
        } else {
          newBalances[loan.borrower] = borrowerBal + repayAmount;
          newBalances[loan.lender]   = lenderBal - repayAmount;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', latestSession.id), {
          balances: newBalances
        });
      }
    } catch (err) { console.error('Error updating loan:', err); }
  };

  const getPlayerName = id => config.players.find(p => p.id === id)?.name || id;

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="animate-pulse flex flex-col items-center">
          <Trophy className="h-12 w-12 text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold">Loading Championship...</h2>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <Trophy className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Poker Championship Tracker</h1>
              <p className="text-xs text-slate-400">
                {config.players.length} Players • Current Day:{' '}
                <span className="text-emerald-400 font-bold">{currentDay}</span>
              </p>
            </div>
          </div>

          <nav className="flex space-x-1 mt-4 sm:mt-0 bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'dashboard', icon: Trophy,       label: 'Leaderboard'   },
              { id: 'sessions',  icon: CalendarDays, label: 'Daily Results' },
              { id: 'loans',     icon: HandCoins,    label: 'Loans'         },
              { id: 'settings',  icon: Settings,     label: 'Settings'      },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* ════════ DASHBOARD ════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Current Standings</h2>
                <p className="text-sm text-slate-400">
                  Net Worth = table chips + (loans owed to you incl. interest) − (loans you owe incl. interest).
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md flex flex-col">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">System Net Worth</span>
                  <span className="font-mono text-emerald-400 font-medium">
                    {actualSystemNetWorth.toLocaleString()}{' '}
                    <span className="text-slate-500">/ {config.maxSystemNW.toLocaleString()}</span>
                  </span>
                </div>
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md flex flex-col">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Salary Ledger</span>
                  <span className="font-mono text-blue-400 font-medium">
                    +{salaryPerPlayer.toLocaleString()}{' '}
                    <span className="text-slate-500">({totalPaydays} paydays)</span>
                  </span>
                </div>
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md flex flex-col">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Next Payday</span>
                  <span className="font-mono text-purple-400 font-medium">
                    {actualSystemNetWorth >= config.maxSystemNW
                      ? 'Maxed Out'
                      : `In ${nextPaydayIn} Day${nextPaydayIn !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Rank</th>
                    <th className="px-6 py-4 font-semibold">Player</th>
                    <th className="px-6 py-4 font-semibold text-right">Table Chips</th>
                    <th className="px-6 py-4 font-semibold text-right">True Poker P/L</th>
                    <th className="px-6 py-4 font-semibold text-right text-blue-400">Salary</th>
                    <th className="px-6 py-4 font-semibold text-right">Active Loans</th>
                    <th className="px-6 py-4 font-semibold text-right">Total Net Worth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {playerStats.map((stat, index) => (
                    <tr key={stat.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index === 1 ? 'bg-slate-400/20 text-slate-300' :
                          index === 2 ? 'bg-amber-700/20 text-amber-500' : 'text-slate-500'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-200">{stat.name}</td>
                      <td className="px-6 py-4 text-right text-slate-400">
                        {stat.currentTableBalance.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-right font-medium ${
                        stat.tablePL > 0 ? 'text-emerald-400' :
                        stat.tablePL < 0 ? 'text-red-400' : 'text-slate-500'
                      }`}>
                        {stat.tablePL > 0 ? '+' : ''}{stat.tablePL.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-blue-400 font-mono">
                        +{stat.salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {stat.borrowed > 0 && (
                          <span className="text-red-400 text-xs block">
                            Owes: {stat.borrowed.toLocaleString()}
                          </span>
                        )}
                        {stat.lentOut > 0 && (
                          <span className="text-emerald-400 text-xs block">
                            Owed: {stat.lentOut.toLocaleString()}
                          </span>
                        )}
                        {stat.borrowed === 0 && stat.lentOut === 0 && (
                          <span className="text-slate-600">−</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-lg text-white">
                        {stat.netWorth.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════ SESSIONS ════════ */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Daily Ledger</h2>
                <p className="text-sm text-slate-400">Physical table chip movements day by day.</p>
              </div>
              <button
                onClick={openSessionModal}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5" />
                Record Day
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
                <CalendarDays className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300">No days recorded</h3>
                <p className="text-slate-500">Record Day 1 to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sessions.map(session => {
                  const prevSession = sessions.find(
                    s => Number(s.dayNumber) < Number(session.dayNumber)
                  );

                  const currentDayState = getSystemStateAtDay(Number(session.dayNumber));
                  const prevDayState = getSystemStateAtDay(prevSession ? Number(prevSession.dayNumber) : 0);
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
                    <div
                      key={session.id}
                      className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col shadow-lg relative overflow-hidden"
                    >
                      {isPayday && (
                        <div className="absolute top-0 left-0 w-full bg-blue-500/20 border-b border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase text-center py-1 tracking-wider">
                          💰 Payday: +{config.salaryAmount.toLocaleString()} Salary Added To Chips
                        </div>
                      )}

                      <div className={`flex justify-between items-start mb-4 border-b border-slate-800 pb-3 ${isPayday ? 'mt-4' : ''}`}>
                        <div>
                          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider block mb-1">Session</span>
                          <h3 className="text-xl font-bold text-white">Day {session.dayNumber}</h3>
                          {prevSession && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              vs Day {prevSession.dayNumber}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete Day ${session.dayNumber}?`)) deleteSession(session.id);
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          title="Delete Session"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto max-h-[200px] pr-2 space-y-2">
                        {activePlayers.length === 0 && (
                          <p className="text-sm text-slate-500 italic">No poker P/L changed this day.</p>
                        )}
                        {activePlayers.map(([name, val]) => (
                          <div key={name} className="flex justify-between items-center text-sm">
                            <span className="text-slate-300">{name}</span>
                            <span className={`font-mono font-medium ${val > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {val > 0 ? '+' : ''}{val.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════ LOANS ════════ */}
        {activeTab === 'loans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Loan Ledger</h2>
                <p className="text-sm text-slate-400">
                  Active loan amounts affect Net Worth at full repayment value (principal + interest).
                </p>
              </div>
              <button
                onClick={openLoanModal}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5" />
                Record Loan
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Day Issued</th>
                    <th className="px-6 py-4 font-semibold">Deadline</th>
                    <th className="px-6 py-4 font-semibold">Details</th>
                    <th className="px-6 py-4 font-semibold">Amount / Repayment</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loans.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500 italic">
                        No loans recorded yet.
                      </td>
                    </tr>
                  )}
                  {loans.map(loan => {
                    const isOverdue = currentDay > Number(loan.deadlineDay) && loan.status === 'active';
                    const repay     = repaymentAmount(loan);

                    return (
                      <tr
                        key={loan.id}
                        className={`hover:bg-slate-800/50 transition-colors ${loan.status === 'settled' ? 'opacity-50' : ''}`}
                      >
                        <td className="px-6 py-4 text-slate-400 font-medium">Day {loan.dayIssued}</td>
                        <td className={`px-6 py-4 font-medium ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                          Day {loan.deadlineDay}
                          {isOverdue && (
                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-400 mt-1">
                              <AlertCircle className="w-3 h-3" /> Overdue
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-red-400">{getPlayerName(loan.borrower)}</span>
                            <ArrowRightLeft className="h-4 w-4 text-slate-600" />
                            <span className="font-medium text-emerald-400">{getPlayerName(loan.lender)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{Number(loan.amount).toLocaleString()}</div>
                          <div className="text-xs text-slate-500">
                            @ {loan.interest}% → repay{' '}
                            <span className="text-amber-400 font-semibold">{repay.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            loan.status === 'active'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {loan.status === 'active' ? 'Active' : 'Settled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => toggleLoanStatus(loan)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                              loan.status === 'active'
                                ? 'bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700'
                                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {loan.status === 'active' ? 'Mark Settled' : 'Re-open'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════ SETTINGS ════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Championship Configuration</h2>
                <p className="text-sm text-slate-400">Settings sync universally to all players in real-time.</p>
              </div>
              <button
                onClick={saveSettings}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-lg"
              >
                <Check className="h-5 w-5" />
                Save Settings
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Game Rules Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl md:col-span-1 h-fit">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-4">
                  <Settings className="w-5 h-5 text-blue-400" /> Game Rules
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Max System Net Worth</label>
                    <input
                      type="number"
                      value={settingsDraft.maxSystemNW}
                      onChange={e => handleConfigChange('maxSystemNW', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Payday Salary Amount</label>
                    <input
                      type="number"
                      value={settingsDraft.salaryAmount}
                      onChange={e => handleConfigChange('salaryAmount', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Payday Interval (Days)</label>
                    <input
                      type="number"
                      value={settingsDraft.paydayInterval}
                      onChange={e => handleConfigChange('paydayInterval', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Roster Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl md:col-span-2">
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Player Roster
                  </h3>
                  <button
                    onClick={addPlayer}
                    className="flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Player
                  </button>
                </div>

                <div className="space-y-3">
                  {settingsDraft.players.map((p, idx) => (
                    <div key={p.id} className="flex gap-3 items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <div className="w-12 text-center bg-slate-900 rounded py-1 border border-slate-800 text-slate-500 text-xs font-bold shrink-0">
                        {p.id}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={p.name}
                          onChange={e => handlePlayerChange(idx, 'name', e.target.value)}
                          placeholder="Player Name"
                          className="w-full bg-transparent text-white font-medium focus:outline-none"
                        />
                      </div>
                      <div className="w-32 shrink-0">
                        <div className="flex items-center bg-slate-900 rounded border border-slate-800 px-2">
                          <span className="text-slate-500 text-xs">$</span>
                          <input
                            type="number"
                            value={p.startBalance}
                            onChange={e => handlePlayerChange(idx, 'startBalance', e.target.value)}
                            className="w-full bg-transparent p-1.5 text-white font-mono text-sm focus:outline-none text-right"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removePlayer(idx)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
                        title="Remove Player"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ════════ RECORD SESSION MODAL ════════ */}
      {showSessionModal && (() => {
        const draftState = getSystemStateAtDay(Number(sessionDay) || 0);
        const expectedCirculation = draftState.amountInCirculation; 
        const draftTotal  = Object.values(sessionDraft).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const circulationDiff = draftTotal - expectedCirculation;
        const isTargetDayPayday = Number(sessionDay) > 0 && Number(sessionDay) % config.paydayInterval === 0;

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 rounded-t-2xl z-10">
                <div>
                  <h3 className="text-xl font-bold text-white">Record Table Balances</h3>
                  <p className="text-sm text-slate-400">Update physical chip counts. {isTargetDayPayday ? <span className="text-emerald-400">Payday salary was auto-added!</span> : "Unchanged values carry over."}</p>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Day Number</label>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-bold bg-slate-950 px-4 py-3 rounded-lg border border-slate-800">Day</span>
                    <input
                      type="number"
                      value={sessionDay}
                      onChange={e => setSessionDay(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-slate-300">End of Day Chips</h4>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm px-3 py-1 rounded-full font-mono ${
                        circulationDiff === 0
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400 font-bold border border-red-500/30'
                      }`}>
                        Diff: {circulationDiff > 0 ? '+' : ''}{circulationDiff} {circulationDiff !== 0 && '(Check Typos!)'}
                      </div>
                      <div className="text-sm px-3 py-1 rounded-full font-mono bg-slate-800 text-slate-300">
                        Total: {draftTotal.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {config.players.map(p => {
                      const currentBal = Number(sessionDraft[p.id] || 0);
                      const isEdited = currentBal !== (sessions[0]?.balances?.[p.id] ?? Number(p.startBalance));

                      return (
                        <div key={p.id} className="relative">
                          <label className="absolute -top-2 left-2 bg-slate-950 px-1 text-[10px] text-slate-400 uppercase font-semibold">
                            {p.name} {isEdited && <span className="text-emerald-400">*</span>}
                          </label>
                          <input
                            type="number"
                            value={sessionDraft[p.id] === 0 ? '' : sessionDraft[p.id]}
                            placeholder="0"
                            onChange={e => handleSessionDraftChange(p.id, e.target.value)}
                            className={`w-full bg-slate-900 border rounded-lg p-3 pt-4 text-white font-mono focus:outline-none transition-colors ${
                              isEdited ? 'border-emerald-500/50' : 'border-slate-800'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSessionModal(false)}
                    className="px-5 py-2.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSession}
                    className="px-5 py-2.5 rounded-lg font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors flex items-center gap-2"
                  >
                    <Check className="h-5 w-5" />
                    Save Balances
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════ RECORD LOAN MODAL ════════ */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-emerald-500" />
                Record Loan
              </h3>
              <button
                onClick={() => setShowLoanModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Day Issued</label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                    <span className="px-3 text-slate-500 text-sm font-bold bg-slate-900">Day</span>
                    <input
                      type="number"
                      value={loanDraft.dayIssued}
                      onChange={e => setLoanDraft({ ...loanDraft, dayIssued: Number(e.target.value) })}
                      className="w-full p-2.5 text-white focus:outline-none focus:bg-slate-800/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Deadline Day</label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                    <span className="px-3 text-slate-500 text-sm font-bold bg-slate-900">Day</span>
                    <input
                      type="number"
                      value={loanDraft.deadlineDay}
                      onChange={e => setLoanDraft({ ...loanDraft, deadlineDay: Number(e.target.value) })}
                      className="w-full p-2.5 text-white focus:outline-none focus:bg-slate-800/50"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Borrower</label>
                  <select
                    value={loanDraft.borrower}
                    onChange={e => setLoanDraft({ ...loanDraft, borrower: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500/50"
                  >
                    <option value="" disabled>Select...</option>
                    {config.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Lender</label>
                  <select
                    value={loanDraft.lender}
                    onChange={e => setLoanDraft({ ...loanDraft, lender: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="" disabled>Select...</option>
                    {config.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Principal</label>
                  <input
                    type="number" min="1"
                    value={loanDraft.amount || ''}
                    onChange={e => setLoanDraft({ ...loanDraft, amount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Interest (%)</label>
                  <input
                    type="number" min="0"
                    value={loanDraft.interest}
                    onChange={e => setLoanDraft({ ...loanDraft, interest: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Live repayment preview */}
              {loanDraft.amount > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm flex justify-between items-center">
                  <span className="text-slate-400">Total repayment obligation</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {Math.round(loanDraft.amount * (1 + loanDraft.interest / 100)).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex gap-3">
                <button
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 py-2.5 rounded-lg font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveLoan}
                  disabled={!loanDraft.borrower || !loanDraft.lender || loanDraft.borrower === loanDraft.lender || loanDraft.amount <= 0}
                  className="flex-1 py-2.5 rounded-lg font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Loan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}