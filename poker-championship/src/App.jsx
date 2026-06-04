import { useState, useEffect, useMemo } from 'react';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Trophy, CalendarDays, HandCoins, Settings, Crown, Lock, Unlock, Dices } from 'lucide-react';

// Imports from our new modular files
import { auth, db, safeAppId } from './firebase';
import {
  DEFAULT_CONFIG,
  repaymentAmount,
  getSystemStateAtDay,
  calculatePlayerStats
} from './utils/pokerEngine';

import PinModal from './components/PinModal';
import SessionModal from './components/SessionModal';
import LoanModal from './components/LoanModal';

import LeaderboardTab from './views/LeaderboardTab';
import SessionsTab from './views/SessionsTab';
import LoansTab from './views/LoansTab';
import SettingsTab from './views/SettingsTab';
import VirtualTableTab from './views/VirtualTableTab';

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
  const [liveGame, setLiveGame]   = useState(null);
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
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
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
    
    const configRef   = doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main');
    const sessionsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions');
    const loansRef    = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');
    const pinRef      = doc(db, 'artifacts', safeAppId, 'public', 'data', 'auth', 'pin');
    const liveGameRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', 'main');

    // Fetch PIN
    const fetchPin = async () => {
      try {
        const pinDoc = await getDoc(pinRef);
        if (pinDoc.exists() && pinDoc.data().value) {
          setSystemPin(pinDoc.data().value);
        } else {
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

    const unsubLiveGame = onSnapshot(liveGameRef, snap => {
      if (snap.exists()) {
        setLiveGame(snap.data());
      } else {
        setLiveGame(null);
      }
    }, err => console.error('Live game fetch error:', err));

    return () => { unsubConfig(); unsubSessions(); unsubLoans(); unsubLiveGame(); };
  }, [user]);

  // Calculations derived from state (pure computations using utils)
  const playerStats = useMemo(() => {
    return calculatePlayerStats(sessions, loans, currentDay, config);
  }, [sessions, loans, currentDay, config]);

  const actualSystemNetWorth = useMemo(() => {
    return playerStats.reduce((sum, p) => sum + p.netWorth, 0);
  }, [playerStats]);

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
    const currentState = getSystemStateAtDay(currentDay, config);
    const nextState = getSystemStateAtDay(nextDay, config);
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

  const navItems = [
    { id: 'dashboard',    icon: Trophy,       label: 'Leaderboard' },
    { id: 'sessions',     icon: CalendarDays, label: 'Sessions' },
    { id: 'loans',        icon: HandCoins,    label: 'Loans' },
    { id: 'virtualTable', icon: Dices,        label: 'Virtual Table' },
    { id: 'settings',     icon: Settings,     label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-amber-500/30 pb-24 md:pb-8">
      {/* Header */}
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

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {activeTab === 'dashboard' && (
          <LeaderboardTab
            actualSystemNetWorth={actualSystemNetWorth}
            config={config}
            salaryPerPlayer={salaryPerPlayer}
            totalPaydays={totalPaydays}
            currentDay={currentDay}
            nextPaydayIn={nextPaydayIn}
            playerStats={playerStats}
          />
        )}

        {activeTab === 'sessions' && (
          <SessionsTab
            isAuthenticated={isAuthenticated}
            openSessionModal={openSessionModal}
            sessions={sessions}
            config={config}
            deleteSession={deleteSession}
          />
        )}

        {activeTab === 'loans' && (
          <LoansTab
            isAuthenticated={isAuthenticated}
            openLoanModal={openLoanModal}
            loans={loans}
            currentDay={currentDay}
            toggleLoanStatus={toggleLoanStatus}
            getPlayerName={getPlayerName}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            isAuthenticated={isAuthenticated}
            setShowPinModal={setShowPinModal}
            settingsDraft={settingsDraft}
            handleConfigChange={handleConfigChange}
            handlePlayerChange={handlePlayerChange}
            addPlayer={addPlayer}
            removePlayer={removePlayer}
            saveSettings={saveSettings}
          />
        )}

        {activeTab === 'virtualTable' && (
          <VirtualTableTab
            isAuthenticated={isAuthenticated}
            config={config}
            liveGame={liveGame}
            currentDay={currentDay}
            sessions={sessions}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
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

      {/* Modals */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onLogin={() => setIsAuthenticated(true)}
        systemPin={systemPin}
      />

      <SessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        sessionDay={sessionDay}
        setSessionDay={setSessionDay}
        sessionDraft={sessionDraft}
        handleSessionDraftChange={handleSessionDraftChange}
        saveSession={saveSession}
        config={config}
        sessions={sessions}
      />

      <LoanModal
        isOpen={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        loanDraft={loanDraft}
        setLoanDraft={setLoanDraft}
        saveLoan={saveLoan}
        config={config}
      />
    </div>
  );
}