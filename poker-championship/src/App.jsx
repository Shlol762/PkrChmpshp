import { useState, useEffect, useMemo } from 'react';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { Trophy, CalendarDays, HandCoins, Settings, Crown, Lock, Unlock, Dices, BookOpen, User } from 'lucide-react';

// Imports from our new modular files
import { auth, db, safeAppId } from './firebase';
import {
  DEFAULT_CONFIG,
  repaymentAmount,
  calculatePaydays,
  calculatePlayerStats
} from './utils/pokerEngine';

import PinModal from './components/PinModal';
import SessionModal from './components/SessionModal';
import LoanModal from './components/LoanModal';
import AuditModal from './components/AuditModal';

import LeaderboardTab from './views/LeaderboardTab';
import SessionsTab from './views/SessionsTab';
import LoansTab from './views/LoansTab';
import SettingsTab from './views/SettingsTab';
import VirtualTableTab from './views/VirtualTableTab';
import RulesTab from './views/RulesTab';
import PlayerDashboardTab from './views/PlayerDashboardTab';

export default function App() {
  const [user, setUser]           = useState(null);
  
  // App State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPinModal, setShowPinModal]       = useState(false);
  const [showAuditModal, setShowAuditModal]   = useState(false);

  const [currentPlayerId, setCurrentPlayerId] = useState(() => localStorage.getItem('poker_player_id') || null);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('poker_player_id') ? 'playerDashboard' : 'dashboard');
  
  const [sessions, setSessions]   = useState([]);
  const [loans, setLoans]         = useState([]);
  const [liveGame, setLiveGame]   = useState(null);
  const [playerDeclarations, setPlayerDeclarations] = useState({});
  const [loading, setLoading]     = useState(true);

  const [config, setConfig]               = useState(DEFAULT_CONFIG);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_CONFIG);

  const currentDay = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.max(...sessions.map(s => Number(s.dayNumber)));
  }, [sessions]);

  const activeSession = useMemo(() => {
    return sessions.find(s => s.status === 'active');
  }, [sessions]);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [sessionDay, setSessionDay]             = useState(1);
  const [sessionDraft, setSessionDraft]         = useState({});

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanDraft, setLoanDraft]         = useState({
    borrower: '', lender: '', amount: 0, interest: 10,
    dayIssued: 0, deadlineDay: 5,
  });

  // ── Auth ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
            await signInWithCustomToken(auth, window.__initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (err) { console.error('Auth error:', err); }
      } else {
        setUser(u);
        setIsAuthenticated(!u.isAnonymous);
      }
    });
    return () => unsub();
  }, []);

  // ── Firestore listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    
    const configRef   = doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main');
    const sessionsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions');
    const loansRef    = collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans');
    const liveGameRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame', 'main');
    const declarationsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations');

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

    const unsubDeclarations = onSnapshot(declarationsRef, snap => {
      const data = {};
      snap.docs.forEach(d => {
        data[d.id] = d.data();
      });
      setPlayerDeclarations(data);
    }, err => console.error('Declarations fetch error:', err));

    return () => { unsubConfig(); unsubSessions(); unsubLoans(); unsubLiveGame(); unsubDeclarations(); };
  }, [user]);

  // Fetch private PINs when admin is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPins = async () => {
      try {
        const pins = {};
        for (const p of config.players) {
          const pinDoc = await getDoc(doc(db, 'privateData', 'pins', 'players', p.id));
          if (pinDoc.exists()) {
            pins[p.id] = pinDoc.data().pin;
          }
        }
        // Merge PINs into settingsDraft
        setSettingsDraft(prev => {
          const updatedPlayers = prev.players.map(p => ({
            ...p,
            pin: pins[p.id] || p.pin || '0000'
          }));
          return { ...prev, players: updatedPlayers };
        });
      } catch (err) {
        console.error("Error fetching player PINs:", err);
      }
    };

    fetchPins();
  }, [isAuthenticated, config.players]);

  // Calculations derived from state (pure computations using utils)
  const playerStats = useMemo(() => {
    return calculatePlayerStats(sessions, loans, currentDay, config);
  }, [sessions, loans, currentDay, config]);

  const actualSystemNetWorth = useMemo(() => {
    return playerStats.reduce((sum, p) => sum + p.netWorth, 0);
  }, [playerStats]);

  const salaryPerPlayer = playerStats[0]?.salary || 0;
  
  let totalPaydays = 0;
  sessions.forEach(s => {
    if (s.paydaysDistributed && Object.keys(s.paydaysDistributed).length > 0) {
      totalPaydays++;
    }
  });

  const nextPaydayIn = config.paydayInterval - (currentDay % config.paydayInterval);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleAdminLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (err) {
      console.error('Admin login error:', err);
      return { success: false, error: err.message };
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Admin logout error:', err);
    }
  };

  const handlePlayerLogin = async (playerId, pin) => {
    try {
      const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', playerId);
      await setDoc(claimRef, {
        playerId,
        pin,
        timestamp: new Date().toISOString()
      });
      setCurrentPlayerId(playerId);
      localStorage.setItem('poker_player_id', playerId);
      localStorage.setItem('poker_player_pin', pin);
      setActiveTab('playerDashboard');
      return { success: true };
    } catch (err) {
      console.error("Player PIN login failed:", err);
      return { success: false, error: "Incorrect PIN. Please check with the host." };
    }
  };

  const handleStartDay = async () => {
    if (!user || !isAuthenticated) return;
    const nextDay = currentDay + 1;
    if (!window.confirm(`Start game session for Day ${nextDay}?`)) return;

    try {
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions'), {
        dayNumber: Number(nextDay),
        status: 'active',
        ledger: {},
        balances: {},
        paydaysDistributed: {},
        recordedAt: new Date().toISOString(),
        recordedBy: user.uid
      });
    } catch (err) {
      console.error("Error starting day:", err);
      alert("Failed to start day.");
    }
  };

  const handleCommitDay = async (ledgerDraft) => {
    if (!user || !isAuthenticated || !activeSession) return;
    try {
      const nextDay = activeSession.dayNumber;
      
      // 1. Compile raw final balances from ledgerDraft
      const rawBalances = {};
      config.players.forEach(p => {
        const draft = ledgerDraft[p.id];
        if (draft && draft.played) {
          const latestSession = sessions.find(s => s.id !== activeSession.id && s.status !== 'active');
          const prevBal = latestSession?.balances?.[p.id] ?? Number(p.startBalance || 0);
          rawBalances[p.id] = prevBal - draft.buyIn - draft.rebuys + draft.cashOut;
        } else {
          const latestSession = sessions.find(s => s.id !== activeSession.id && s.status !== 'active');
          const prevBal = latestSession?.balances?.[p.id] ?? Number(p.startBalance || 0);
          rawBalances[p.id] = prevBal;
        }
      });

      // 2. Calculate paydays
      const paydaysToDistribute = calculatePaydays(Number(nextDay), config, rawBalances, loans);
      
      // 3. Final Balances after paydays
      const finalBalances = {};
      config.players.forEach(p => {
        finalBalances[p.id] = rawBalances[p.id] + (paydaysToDistribute[p.id] || 0);
      });

      // 4. Update the active session document
      const sessionRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', activeSession.id);
      
      const finalLedger = {};
      config.players.forEach(p => {
        const draft = ledgerDraft[p.id];
        if (draft && draft.played) {
          finalLedger[p.id] = {
            buyIn: draft.buyIn,
            rebuys: draft.rebuys,
            cashOut: draft.cashOut,
            status: 'cashed_out'
          };
        }
      });

      await updateDoc(sessionRef, {
        status: 'completed',
        balances: finalBalances,
        paydaysDistributed: paydaysToDistribute,
        ledger: finalLedger,
        recordedAt: new Date().toISOString(),
        recordedBy: user.uid
      });

      // 5. Clean up temporary playerClaims and playerDeclarations
      for (const p of config.players) {
        try {
          await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', p.id));
        } catch (e) { /* ignore */ }
        try {
          await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations', p.id));
        } catch (e) { /* ignore */ }
      }

      setShowAuditModal(false);
      alert(`Day ${nextDay} ledger committed and finalized successfully!`);
    } catch (err) {
      console.error("Error committing ledger:", err);
      alert("Failed to commit day.");
    }
  };

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
      players: [...prev.players, { id: newId, name: 'New Player', startBalance: 0, pin: '0000' }]
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
    try {
      // 1. Write the public config with PINs removed so players can't read them
      const publicPlayers = settingsDraft.players.map(p => {
        const { pin, ...publicData } = p;
        return publicData;
      });
      const publicConfig = {
        ...settingsDraft,
        players: publicPlayers
      };
      await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'config', 'main'), publicConfig);

      // 2. Write each player's PIN to the private collection
      for (const p of settingsDraft.players) {
        if (p.pin) {
          const pinRef = doc(db, 'privateData', 'pins', 'players', p.id);
          await setDoc(pinRef, { pin: p.pin });
        }
      }
      alert("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving config:", err);
      alert("Failed to save settings.");
    }
  };

  const openSessionModal = (sessionToEdit = null) => {
    if (sessionToEdit && typeof sessionToEdit === 'object' && sessionToEdit.id) {
      setEditingSessionId(sessionToEdit.id);
      setSessionDay(sessionToEdit.dayNumber);
      const draft = {};
      config.players.forEach(p => {
        const finalBal = Number(sessionToEdit.balances?.[p.id] || 0);
        const payday = Number(sessionToEdit.paydaysDistributed?.[p.id] || 0);
        draft[p.id] = finalBal - payday;
      });
      setSessionDraft(draft);
    } else {
      setEditingSessionId(null);
      const latestSession = sessions.length > 0 ? sessions[0] : null;
      const nextDay = currentDay + 1;

      const draft = {};
      config.players.forEach(p => {
        const lastKnownBalance = latestSession?.balances?.[p.id] ?? Number(p.startBalance || 0);
        draft[p.id] = lastKnownBalance;
      });

      setSessionDraft(draft);
      setSessionDay(nextDay);
    }
    setShowSessionModal(true);
  };

  const handleSessionDraftChange = (playerId, val) => {
    setSessionDraft(prev => ({ ...prev, [playerId]: val === '' ? '' : Number(val) }));
  };

  const saveSession = async () => {
    if (!user) return;
    try {
      const paydaysToDistribute = calculatePaydays(Number(sessionDay), config, sessionDraft, loans);
      
      const finalBalances = {};
      config.players.forEach(p => {
        finalBalances[p.id] = (Number(sessionDraft[p.id]) || 0) + (paydaysToDistribute[p.id] || 0);
      });

      if (editingSessionId) {
        await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', editingSessionId), {
          dayNumber:   Number(sessionDay),
          balances:    finalBalances,
          paydaysDistributed: paydaysToDistribute,
          recordedAt:  new Date().toISOString(),
          recordedBy:  user.uid,
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions'), {
          dayNumber:   Number(sessionDay),
          balances:    finalBalances,
          paydaysDistributed: paydaysToDistribute,
          recordedAt:  new Date().toISOString(),
          recordedBy:  user.uid,
        });
      }
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
      // 1. Add the loan document
      await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'loans'), {
        ...loanDraft, status: 'active', recordedAt: new Date().toISOString(), recordedBy: user.uid,
      });

      // 2. Immediately adjust physical table chips in the latest completed session
      if (sessions.length > 0) {
        const latestSession = sessions[0];
        if (latestSession.status !== 'active') {
          const newBalances = { ...latestSession.balances };
          const principal = Number(loanDraft.amount);

          const borrowerBal = newBalances[loanDraft.borrower] ?? Number(config.players.find(p => p.id === loanDraft.borrower)?.startBalance || 0);
          const lenderBal   = newBalances[loanDraft.lender] ?? Number(config.players.find(p => p.id === loanDraft.lender)?.startBalance || 0);

          newBalances[loanDraft.borrower] = borrowerBal + principal;
          newBalances[loanDraft.lender]   = lenderBal - principal;

          await updateDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', latestSession.id), { balances: newBalances });
        }
      }

      setShowLoanModal(false);
    } catch (err) {
      console.error('Error saving loan:', err);
      alert("Failed to issue loan.");
    }
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
        if (latestSession.status !== 'active') {
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
      }
    } catch (err) { console.error('Error updating loan:', err); }
  };

  const getPlayerName = id => config.players.find(p => p.id === id)?.name || id;

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-zinc-200">
        <div className="animate-pulse flex flex-col items-center">
          <Crown className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold tracking-tight">Loading League...</h2>
        </div>
      </div>
    );
  }

  // Forced Login Gate: blocks entire app if not authenticated
  if (!currentPlayerId && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-zinc-200">
        <PinModal
          isOpen={true}
          onClose={null} // forced
          config={config}
          onPlayerLogin={handlePlayerLogin}
          onAdminLogin={handleAdminLogin}
        />
      </div>
    );
  }

  const navItems = [
    ...(currentPlayerId ? [{ id: 'playerDashboard', icon: User, label: 'My Dashboard' }] : []),
    { id: 'dashboard',    icon: Trophy,       label: 'Leaderboard' },
    { id: 'sessions',     icon: CalendarDays, label: 'Sessions' },
    { id: 'loans',        icon: HandCoins,    label: 'Loans' },
    { id: 'virtualTable', icon: Dices,        label: 'Virtual Table' },
    { id: 'rules',        icon: BookOpen,     label: 'Rules' },
    { id: 'settings',     icon: Settings,     label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-amber-500/30 overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#09090b]/50">
        <div className="flex-1 overflow-y-auto py-8 px-4 space-y-2">
          {navItems.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-amber-400 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => isAuthenticated ? handleAdminLogout() : setShowPinModal(true)}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border transition-all ${
              isAuthenticated
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            <span className="text-sm font-bold">{isAuthenticated ? 'Admin Unlocked' : 'Admin Locked'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Header */}
        <header className="flex-shrink-0 sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5">
          <div className="h-16 flex items-center justify-center relative px-4">
            
            {/* Logo (Left Aligned) */}
            <div className="absolute left-4 md:left-6 bg-gradient-to-br from-amber-400 to-orange-600 p-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Crown className="h-5 w-5 text-white" />
            </div>
 
            {/* Centered Title */}
            <div className="flex flex-col items-center justify-center translate-y-[2px]">
              <h1 className="text-xl font-black text-white tracking-tight leading-none">Championship</h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mt-1">
                Day {currentDay} • {config.players.length} Players
              </p>
            </div>
 
            {/* Mobile Admin Toggle (Absolute right) */}
            <div className="md:hidden absolute right-4">
              <button
                onClick={() => isAuthenticated ? handleAdminLogout() : setShowPinModal(true)}
                className={`p-2 rounded-xl border transition-all ${
                  isAuthenticated
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>
        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
            {activeTab === 'playerDashboard' && (
              <PlayerDashboardTab
                currentPlayerId={currentPlayerId}
                setCurrentPlayerId={setCurrentPlayerId}
                config={config}
                sessions={sessions}
                loans={loans}
                currentDay={currentDay}
                playerStats={playerStats}
                playerDeclarations={playerDeclarations}
              />
            )}

            {activeTab === 'dashboard' && (
              <LeaderboardTab
                actualSystemNetWorth={actualSystemNetWorth}
                config={config}
                salaryPerPlayer={salaryPerPlayer}
                totalPaydays={totalPaydays}
                currentDay={currentDay}
                nextPaydayIn={nextPaydayIn}
                playerStats={playerStats}
                loans={loans}
              />
            )}
 
            {activeTab === 'sessions' && (
              <SessionsTab
                isAuthenticated={isAuthenticated}
                openSessionModal={openSessionModal}
                sessions={sessions}
                config={config}
                deleteSession={deleteSession}
                activeSession={activeSession}
                onStartDay={handleStartDay}
                onOpenAudit={() => setShowAuditModal(true)}
                playerDeclarations={playerDeclarations}
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
                currentPlayerId={currentPlayerId}
                setCurrentPlayerId={setCurrentPlayerId}
                playerDeclarations={playerDeclarations}
              />
            )}
 
            {activeTab === 'rules' && (
              <RulesTab />
            )}
          </div>
        </main>
      </div>
 
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
        config={config}
        onPlayerLogin={handlePlayerLogin}
        onAdminLogin={handleAdminLogin}
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
        loans={loans}
      />
 
      <LoanModal
        isOpen={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        loanDraft={loanDraft}
        setLoanDraft={setLoanDraft}
        saveLoan={saveLoan}
        config={config}
      />

      <AuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        activeSession={activeSession}
        config={config}
        sessions={sessions}
        onCommit={handleCommitDay}
        playerDeclarations={playerDeclarations}
      />
    </div>
  );
}