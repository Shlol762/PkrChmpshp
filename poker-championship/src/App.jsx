import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Trophy, CalendarDays, Plus, Check, X, HandCoins, ArrowRightLeft, AlertCircle, Settings, Trash2, Wallet, Banknote, Crown, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Clock, Lock, Unlock } from 'lucide-react';

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

// Sanitize appId to ensure it doesn't contain slashes which break Firestore document segment counts
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'poker-championship-app';
const safeAppId = rawAppId.replace(/\//g, '_');

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

function repaymentAmount(loan) {
  return Math.round(Number(loan.amount) * (1 + Number(loan.interest || 0) / 100));
}

// ─── PIN Modal Component ────────────────────────────────────────────────────────
function PinModal({ isOpen, onClose, onLogin, systemPin }) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === systemPin) {
      onLogin();
      setPinInput('');
      onClose();
    } else {
      setError(true);
      setPinInput('');
      setTimeout(() => setError(false), 2000); // clear error after 2s
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm flex flex-col items-center shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full">
          <X className="w-5 h-5" />
        </button>
        <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-6">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">Admin Access</h2>
        <p className="text-zinc-500 text-sm mb-8 text-center">Enter PIN to unlock controls.</p>

        <form onSubmit={handlePinSubmit} className="w-full">
          <div className="relative mb-6">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className={`w-full bg-zinc-950 border rounded-xl p-4 text-center text-white font-mono text-2xl tracking-[0.5em] focus:outline-none transition-colors ${
                error ? 'border-rose-500/50 bg-rose-500/5 focus:border-rose-500' : 'border-white/10 focus:border-amber-500'
              }`}
              autoFocus
            />
            {error && (
              <p className="absolute -bottom-6 left-0 right-0 text-center text-xs text-rose-400 font-semibold animate-in slide-in-from-top-1">
                Incorrect PIN
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex justify-center items-center gap-2"
          >
            Unlock <Unlock className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]           = useState(null);
  
  // App State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [systemPin, setSystemPin]             = useState(null);
  const [isCheckingPin, setIsCheckingPin]     = useState(true);
  const [showPinModal, setShowPinModal]       = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessions, setSessions]   = useState([]);
  const [loans, setLoans]         = useState([]);
  const [loading, setLoading]     = useState(true);

  const [config, setConfig]               = useState(DEFAULT_CONFIG);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_CONFIG);

  const currentDay = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.max(...sessions.map(s => Number(s.dayNumber)));
  }, [sessions]);

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
    
    // Safely formatted collection and doc references to ensure correct segment counts
    const configRef   = doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main');
    const sessionsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions');
    const loansRef    = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');
    const pinRef      = doc(db, 'artifacts', safeAppId, 'public', 'data', 'auth', 'pin');

    // Fetch PIN
    const fetchPin = async () => {
      try {
        const pinDoc = await getDoc(pinRef);
        if (pinDoc.exists() && pinDoc.data().value) {
          setSystemPin(pinDoc.data().value);
        } else {
          // If no PIN document exists, default to '1234' or bypass entirely.
          // For security, let's establish a default if none is found in the DB.
          console.log("No PIN found in DB, defaulting to '0000'");
          setSystemPin("0000"); 
        }
      } catch (error) {
        console.error("Error fetching PIN:", error);
        setSystemPin("0000"); // Fallback PIN on error
      } finally {
        setIsCheckingPin(false);
      }
    };
    fetchPin();


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
      data.sort((a, b) => Number(b.dayNumber) - Number(a.dayNumber));
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

  const actualSystemNetWorth = playerStats.reduce((sum, p) => sum + p.netWorth, 0);
  const salaryPerPlayer = playerStats[0]?.salary || 0;
  const totalPaydays    = Math.floor(currentDay / config.paydayInterval);
  const nextPaydayIn    = config.paydayInterval - (currentDay % config.paydayInterval);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleConfigChange = (field, value) => setSettingsDraft(prev => ({ ...prev, [field]: Number(value) }));
  
  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...settingsDraft.players];
    newPlayers[index] = { ...newPlayers[index], [field]: field === 'startBalance' ? Number(value) : value };
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
    if (window.confirm("Warning: Removing a player might cause errors. Proceed?")) {
      const newPlayers = settingsDraft.players.filter((_, i) => i !== index);
      setSettingsDraft(prev => ({ ...prev, players: newPlayers }));
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    try { await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main'), settingsDraft); } 
    catch (err) { console.error("Error saving config:", err); }
  };

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
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions'), {
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
    try { await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', id)); } 
    catch (err) { console.error('Error deleting session:', err); }
  };

  const openLoanModal = () => {
    setLoanDraft({ borrower: '', lender: '', amount: 0, interest: 10, dayIssued: currentDay, deadlineDay: currentDay + 5 });
    setShowLoanModal(true);
  };

  const saveLoan = async () => {
    if (!user || !loanDraft.borrower || !loanDraft.lender || loanDraft.amount <= 0) return;
    try {
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans'), {
        ...loanDraft, status: 'active', recordedAt: new Date().toISOString(), recordedBy: user.uid,
      });
      setShowLoanModal(false);
    } catch (err) { console.error('Error saving loan:', err); }
  };

  const toggleLoanStatus = async (loan) => {
    if (!user) return;
    try {
      const isSettling = loan.status === 'active';
      const repayAmount = repaymentAmount(loan);

      await updateDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'loans', loan.id), {
        status: isSettling ? 'settled' : 'active',
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

        await updateDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', latestSession.id), { balances: newBalances });
      }
    } catch (err) { console.error('Error updating loan:', err); }
  };

  const getPlayerName = id => config.players.find(p => p.id === id)?.name || id;

  // ── Render States ─────────────────────────────────────────────────────────────

  // 1. Show Loading State if auth/data isn't ready
  if (loading || !user || isCheckingPin) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-zinc-200">
        <div className="animate-pulse flex flex-col items-center">
          <Crown className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold tracking-tight">Loading League...</h2>
        </div>
      </div>
    );
  }

  // 2. Show Main App
  const navItems = [
    { id: 'dashboard', icon: Trophy,       label: 'Leaderboard' },
    { id: 'sessions',  icon: CalendarDays, label: 'Sessions' },
    { id: 'loans',     icon: HandCoins,    label: 'Loans' },
    { id: 'settings',  icon: Settings,     label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-amber-500/30 pb-24 md:pb-8">
      
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">Championship</h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mt-1">
                Day {currentDay} • {config.players.length} Players
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
              {navItems.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-amber-400 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
            
            {/* Admin Toggle */}
            <button
              onClick={() => isAuthenticated ? setIsAuthenticated(false) : setShowPinModal(true)}
              className={`p-2 rounded-xl border transition-all ${
                isAuthenticated
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={isAuthenticated ? "Lock Admin Controls" : "Unlock Admin Controls"}
            >
              {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">

        {/* ════════ DASHBOARD ════════ */}
        {activeTab === 'dashboard' && (
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
        )}

        {/* ════════ SESSIONS ════════ */}
        {activeTab === 'sessions' && (
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
        )}

        {/* ════════ LOANS ════════ */}
        {activeTab === 'loans' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Loan Ledger</h2>
                <p className="text-sm text-zinc-500">Track player-to-player debts.</p>
              </div>
              {isAuthenticated && (
                <button
                  onClick={openLoanModal}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-2.5 px-5 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                >
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">New Loan</span>
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loans.length === 0 && (
                 <div className="col-span-full text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed">
                  <HandCoins className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-zinc-300">No active loans</h3>
                  <p className="text-zinc-500 text-sm mt-1">Player debts will appear here.</p>
                </div>
              )}
              {loans.map(loan => {
                const isOverdue = currentDay > Number(loan.deadlineDay) && loan.status === 'active';
                const repay = repaymentAmount(loan);

                return (
                  <div key={loan.id} className={`bg-zinc-900/40 border p-5 rounded-2xl flex flex-col relative transition-all ${loan.status === 'settled' ? 'opacity-60 border-white/5' : isOverdue ? 'border-rose-500/30' : 'border-white/10'}`}>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${loan.status === 'active' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-400'}`}>
                        {loan.status === 'active' ? 'Active' : 'Settled'}
                      </div>
                      {isAuthenticated && (
                        <button
                          onClick={() => toggleLoanStatus(loan)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                            loan.status === 'active'
                              ? 'bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400'
                              : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {loan.status === 'active' ? 'Settle' : 'Re-open'}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl mb-4 border border-white/5">
                      <div className="text-center flex-1">
                        <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Borrower</div>
                        <div className="font-bold text-rose-400">{getPlayerName(loan.borrower)}</div>
                      </div>
                      <ArrowRightLeft className="w-4 h-4 text-zinc-600 mx-2" />
                      <div className="text-center flex-1">
                        <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Lender</div>
                        <div className="font-bold text-emerald-400">{getPlayerName(loan.lender)}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-end mt-auto pt-2">
                      <div>
                        <div className="text-xs text-zinc-500 font-medium mb-1">Repayment ({loan.interest}%)</div>
                        <div className="text-xl font-bold text-white tabular-nums">{repay.toLocaleString()}</div>
                      </div>
                      <div className={`text-xs font-medium text-right ${isOverdue ? 'text-rose-400' : 'text-zinc-400'}`}>
                        Due Day {loan.deadlineDay}
                        {isOverdue && <div className="flex items-center justify-end gap-1 font-bold mt-1 uppercase text-[10px]"><AlertCircle className="w-3 h-3"/> Overdue</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════ SETTINGS ════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {!isAuthenticated ? (
              <div className="text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed">
                <Lock className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-300">Settings Locked</h3>
                <p className="text-zinc-500 text-sm mt-1 mb-6">Admin access is required to change rules and roster.</p>
                <button onClick={() => setShowPinModal(true)} className="bg-amber-500 text-amber-950 font-bold py-2.5 px-6 rounded-xl hover:bg-amber-400 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  Unlock Controls
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-end gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                    <p className="text-sm text-zinc-500">Configure rules & players.</p>
                  </div>
                  <button
                    onClick={saveSettings}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                  >
                    <Check className="h-5 w-5" />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Game Rules Column (This container was accidentally deleted!) */}
                  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:col-span-1 h-fit">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 mb-6">
                      <Settings className="w-5 h-5 text-blue-400" /> Game Rules
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Max System Net Worth</label>
                        <input type="number" value={settingsDraft.maxSystemNW} onChange={e => handleConfigChange('maxSystemNW', e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Payday Salary Amount</label>
                        <input type="number" value={settingsDraft.salaryAmount} onChange={e => handleConfigChange('salaryAmount', e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Payday Interval (Days)</label>
                        <input type="number" value={settingsDraft.paydayInterval} onChange={e => handleConfigChange('paydayInterval', e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                    </div>
                  </div>

                  {/* Player Roster Column */}
                  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-500" /> Player Roster
                      </h3>
                      <button onClick={addPlayer} className="flex items-center gap-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition-colors">
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>

                    <div className="space-y-3">
                      {settingsDraft.players.map((p, idx) => (
                        <div key={p.id} className="flex gap-3 items-center bg-zinc-950/50 p-3 rounded-xl border border-white/5 group">
                          <div className="w-10 text-center text-zinc-600 text-xs font-bold shrink-0">{p.id}</div>
                          <div className="flex-1">
                            <input type="text" value={p.name} onChange={e => handlePlayerChange(idx, 'name', e.target.value)} placeholder="Player Name"
                              className="w-full bg-transparent text-zinc-200 font-medium focus:outline-none" />
                          </div>
                          <div className="w-28 shrink-0 flex items-center bg-zinc-900 rounded-lg border border-white/5 px-2 focus-within:border-amber-500/50 transition-colors">
                            <span className="text-zinc-500 text-xs">$</span>
                            <input type="number" value={p.startBalance} onChange={e => handlePlayerChange(idx, 'startBalance', e.target.value)}
                              className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none text-right" />
                          </div>
                          <button onClick={() => removePlayer(idx)} className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-40">
        <nav className="bg-[#09090b]/90 backdrop-blur-xl border border-white/10 rounded-2xl flex justify-around p-2 shadow-2xl">
          {navItems.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-full py-2 rounded-xl transition-all duration-200 ${
                  isActive ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <tab.icon className={`h-5 w-5 mb-1 ${isActive ? 'fill-amber-400/20' : ''}`} />
                <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ════════ PIN MODAL ════════ */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onLogin={() => setIsAuthenticated(true)}
        systemPin={systemPin}
      />

      {/* ════════ RECORD SESSION MODAL ════════ */}
      {showSessionModal && (() => {
        const draftState = getSystemStateAtDay(Number(sessionDay) || 0);
        const expectedCirculation = draftState.amountInCirculation; 
        const draftTotal  = Object.values(sessionDraft).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const circulationDiff = draftTotal - expectedCirculation;
        const isTargetDayPayday = Number(sessionDay) > 0 && Number(sessionDay) % config.paydayInterval === 0;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
            <div className="bg-[#09090b] sm:bg-zinc-900/90 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
              
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
                <div>
                  <h3 className="text-lg font-bold text-white">Record Chips</h3>
                  <p className="text-xs text-zinc-400 mt-1">{isTargetDayPayday ? <span className="text-emerald-400 font-medium">Payday distributed automatically.</span> : "Update end-of-day balances."}</p>
                </div>
                <button onClick={() => setShowSessionModal(false)} className="bg-white/10 text-zinc-300 hover:text-white p-2 rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                <div className="mb-6 flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Day</label>
                    <input type="number" value={sessionDay} onChange={e => setSessionDay(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl p-4 text-white font-bold text-lg focus:outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div className="flex-1 flex flex-col justify-end">
                    <div className={`p-3 rounded-xl border flex flex-col justify-center h-[56px] ${circulationDiff === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                      <span className="text-[10px] font-bold uppercase text-zinc-500">Diff</span>
                      <span className={`font-mono font-bold text-sm ${circulationDiff === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {circulationDiff > 0 ? '+' : ''}{circulationDiff} {circulationDiff !== 0 && '(!)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {config.players.map(p => {
                    const currentBal = Number(sessionDraft[p.id] || 0);
                    const isEdited = currentBal !== (sessions[0]?.balances?.[p.id] ?? Number(p.startBalance));

                    return (
                      <div key={p.id} className="relative group">
                        <label className="absolute top-2 left-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          {p.name} {isEdited && <span className="text-emerald-400">*</span>}
                        </label>
                        <input type="number" value={sessionDraft[p.id] === 0 ? '' : sessionDraft[p.id]} placeholder="0" onChange={e => handleSessionDraftChange(p.id, e.target.value)}
                          className={`w-full bg-zinc-950 border rounded-xl p-3 pt-6 pb-2 text-white font-mono text-lg focus:outline-none transition-colors ${
                            isEdited ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/5'
                          }`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 border-t border-white/5 bg-[#09090b] sm:rounded-b-3xl pb-8 sm:pb-5">
                <button onClick={saveSession} className="w-full py-4 rounded-xl font-bold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors flex justify-center items-center gap-2">
                  <Check className="h-5 w-5" /> Save Day {sessionDay} Balances
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ════════ RECORD LOAN MODAL ════════ */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
          <div className="bg-[#09090b] sm:bg-zinc-900/90 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col">
            
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-amber-500" /> New Loan
              </h3>
              <button onClick={() => setShowLoanModal(false)} className="bg-white/10 text-zinc-300 hover:text-white p-2 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 pb-8 sm:pb-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Issue Day</label>
                  <input type="number" value={loanDraft.dayIssued} onChange={e => setLoanDraft({ ...loanDraft, dayIssued: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Deadline</label>
                  <input type="number" value={loanDraft.deadlineDay} onChange={e => setLoanDraft({ ...loanDraft, deadlineDay: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-1 bg-zinc-900 p-1.5 rounded-full border border-white/10 z-10">
                  <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-rose-400 mb-2">Borrower</label>
                  <select value={loanDraft.borrower} onChange={e => setLoanDraft({ ...loanDraft, borrower: e.target.value })}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-rose-500 appearance-none">
                    <option value="" disabled>Select...</option>
                    {config.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-emerald-400 mb-2">Lender</label>
                  <select value={loanDraft.lender} onChange={e => setLoanDraft({ ...loanDraft, lender: e.target.value })}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-emerald-500 appearance-none">
                    <option value="" disabled>Select...</option>
                    {config.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Principal</label>
                  <input type="number" min="1" value={loanDraft.amount || ''} placeholder="0" onChange={e => setLoanDraft({ ...loanDraft, amount: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Interest (%)</label>
                  <input type="number" min="0" value={loanDraft.interest} onChange={e => setLoanDraft({ ...loanDraft, interest: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              </div>

              {loanDraft.amount > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-amber-500/80 text-xs font-bold uppercase tracking-wider">Owed Total</span>
                  <span className="font-bold text-amber-400 text-xl tabular-nums">
                    {Math.round(loanDraft.amount * (1 + loanDraft.interest / 100)).toLocaleString()}
                  </span>
                </div>
              )}

              <button onClick={saveLoan} disabled={!loanDraft.borrower || !loanDraft.lender || loanDraft.borrower === loanDraft.lender || loanDraft.amount <= 0}
                className="w-full py-4 rounded-xl font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                Issue Loan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Add the custom icon for missing lucide import handling
function Users(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}