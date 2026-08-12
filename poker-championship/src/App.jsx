import { useState, useEffect, useMemo } from 'react';
import { signInWithCustomToken, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, runTransaction } from 'firebase/firestore';
import { Trophy, CalendarDays, HandCoins, Settings, Crown, Lock, Unlock, Dices, BookOpen, User, TrendingUp, KeyRound } from 'lucide-react';

// Imports from our new modular files
import { auth, db, safeAppId } from './firebase';
import {
  DEFAULT_CONFIG,
  repaymentAmount,
  calculatePaydays,
  calculatePlayerStats
} from './utils/pokerEngine';
import {
  commitSessionDay,
  recordLoanIssuance,
  recordLoanSettlement,
  saveBalances as saveBalancesLog,
  globalResetBalancesAndBaselines,
  recordBalanceCorrection,
  releaseFrozenToLender
} from './utils/ledgerEngine';

import PinModal from './components/PinModal';
import SessionModal from './components/SessionModal';
import LoanModal from './components/LoanModal';
import AuditModal from './components/AuditModal';

import LeaderboardTab from './views/LeaderboardTab';
import AccountingTab from './views/AccountingTab';
import LoansTab from './views/LoansTab';
import SettingsTab from './views/SettingsTab';
import VirtualTableTab from './views/VirtualTableTab';
import RulesTab from './views/RulesTab';
import PlayerDashboardTab from './views/PlayerDashboardTab';
import StatsTab from './views/StatsTab';

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
  const [liveGames, setLiveGames] = useState({});
  const [playerDeclarations, setPlayerDeclarations] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  const [balances, setBalances]           = useState({});
  const [balancesDraft, setBalancesDraft] = useState({});
  const [balancesLoaded, setBalancesLoaded] = useState(false);

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
    const liveGamesRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'liveGame');
    const declarationsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'playerDeclarations');
    const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');

    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setBalancesLoaded(true);
    }, 1500);

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
    }, err => {
      console.error('Session fetch error:', err);
      setLoading(false);
    });

    const unsubLoans = onSnapshot(loansRef, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => Number(b.dayIssued) - Number(a.dayIssued));
      setLoans(data);
    }, err => console.error('Loan fetch error:', err));

    const unsubLiveGames = onSnapshot(liveGamesRef, snap => {
      const data = {};
      snap.docs.forEach(d => {
        data[d.id] = d.data();
      });
      setLiveGames(data);
    }, err => console.error('Live games collection fetch error:', err));

    const unsubDeclarations = onSnapshot(declarationsRef, snap => {
      const data = {};
      snap.docs.forEach(d => {
        data[d.id] = d.data();
      });
      setPlayerDeclarations(data);
    }, err => console.error('Declarations fetch error:', err));

    const transactionsRef = collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions');
    const unsubTransactions = onSnapshot(transactionsRef, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
      setTransactions(data);
    }, err => console.error('Transactions fetch error:', err));

    const unsubBalances = onSnapshot(balancesRef, snap => {
      if (snap.exists()) {
        setBalances(snap.data());
        setBalancesDraft(snap.data());
      } else {
        setBalances({});
        setBalancesDraft({});
      }
      setBalancesLoaded(true);
    }, err => {
      console.error('Balances fetch error:', err);
      setBalancesLoaded(true);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubConfig();
      unsubSessions();
      unsubLoans();
      unsubLiveGames();
      unsubDeclarations();
      unsubTransactions();
      unsubBalances();
    };
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

  // ── Auto-Migration ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !balancesLoaded || !user) return;

    const runMigration = async () => {
      if (Object.keys(balances).length > 0) return;

      const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
      const completedSessions = sessions.filter(s => s.status !== 'active');
      const latestSession = completedSessions.length > 0 ? completedSessions[0] : null;

      const initialBalances = {};
      config.players.forEach(p => {
        const val = latestSession?.balances?.[p.id];
        let bank = 0;
        let wallet = 0;
        if (val !== undefined && val !== null) {
          if (typeof val === 'object') {
            bank = Number(val.bank || 0);
            wallet = Number(val.wallet || 0);
          } else {
            bank = Number(val);
          }
        } else {
          bank = Number(p.startBalance || 0);
        }
        initialBalances[p.id] = { bank, wallet };
      });

      try {
        await setDoc(balancesRef, initialBalances);
        console.log("Migration complete: Initialized central balances document with:", initialBalances);
      } catch (err) {
        console.error("Migration error:", err);
      }
    };

    if (Object.keys(balances).length === 0 && config.players.length > 0) {
      runMigration();
    }
  }, [loading, balancesLoaded, balances, sessions, config, user]);

  // ── Restore Player Claim ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentPlayerId || !activeSession || !user) return;
    
    const checkAndRestoreClaim = async () => {
      const pin = localStorage.getItem('poker_player_pin');
      if (!pin) return;
      
      const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', currentPlayerId);
      
      const writeClaim = async () => {
        try {
          await setDoc(claimRef, {
            playerId: currentPlayerId,
            pin,
            uid: user.uid,
            timestamp: new Date().toISOString()
          });
          console.log(`Successfully restored player claim for ${currentPlayerId}`);
        } catch (writeErr) {
          console.error("Failed to write player claim:", writeErr);
        }
      };

      try {
        const snap = await getDoc(claimRef);
        if (!snap.exists() || snap.data().uid !== user.uid) {
          console.log(`Re-creating missing or stale player claim for ${currentPlayerId} using stored PIN`);
          await writeClaim();
        }
      } catch (err) {
        // If read fails (e.g. Permission Denied because document belongs to another UID), overwrite it
        console.log(`Stale or unreadable claim for ${currentPlayerId}, updating claim document...`);
        await writeClaim();
      }
    };
    
    checkAndRestoreClaim();
  }, [currentPlayerId, activeSession, user]);

  // Calculations derived from state (pure computations using utils)
  const playerStats = useMemo(() => {
    return calculatePlayerStats(sessions, loans, currentDay, config, balances, null, playerDeclarations);
  }, [sessions, loans, currentDay, config, balances, playerDeclarations]);

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
        uid: auth.currentUser?.uid || null,
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
    if (!user) return;
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
        recordedBy: 'host:' + user.uid
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
      
      // 1. Compile raw final balances from ledgerDraft using central balances
      const rawBalances = {};
      config.players.forEach(p => {
        const draft = ledgerDraft[p.id];
        const pBal = balances[p.id] || { bank: 0, wallet: 0 };
        const prevBal = typeof pBal === 'object' ? Number(pBal.bank || 0) + Number(pBal.wallet || 0) : Number(pBal || 0);
        if (draft && draft.played) {
          rawBalances[p.id] = prevBal - draft.buyIn - draft.rebuys + draft.cashOut;
        } else {
          rawBalances[p.id] = prevBal;
        }
      });

      // 2. Calculate paydays
      const paydaysToDistribute = calculatePaydays(Number(nextDay), config, rawBalances, loans);
      
      // Find the previous completed session's balances
      const prevSession = sessions
        .filter(s => s.status !== 'active' && Number(s.dayNumber) < Number(activeSession.dayNumber))
        .sort((a, b) => Number(b.dayNumber) - Number(a.dayNumber))[0];
      const prevBalances = prevSession?.balances || {};

      // 3. Atomically commit the session, update balances cache and write transaction logs
      await commitSessionDay(
        db,
        safeAppId,
        activeSession.id,
        ledgerDraft,
        paydaysToDistribute,
        config,
        nextDay,
        'host:' + user.uid,
        prevBalances
      );

      // 4. Clean up temporary playerClaims and playerDeclarations
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
      alert("Failed to commit day: " + err.message);
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
    } else {
      setEditingSessionId(null);
      setSessionDay(currentDay + 1);
    }
    setShowSessionModal(true);
  };

  const saveSession = async (ledgerDraft, dayNumber) => {
    if (!user) return;
    try {
      // 1. Get previous balances for calculation reference
      const getPreviousBalance = (playerId) => {
        const prevSession = sessions
          .filter(s => s.id !== editingSessionId)
          .find(s => Number(s.dayNumber) < Number(dayNumber));
        if (prevSession) {
          const val = prevSession.balances?.[playerId];
          return typeof val === 'object' && val !== null ? Number(val.bank || 0) + Number(val.wallet || 0) : Number(val || 0);
        }
        return Number(config.players.find(p => p.id === playerId)?.startBalance || 0);
      };

      // 2. Compute rawBalances (poker chip balance before payday distribution)
      const rawBalances = {};
      config.players.forEach(p => {
        const draft = ledgerDraft[p.id];
        const prevBal = getPreviousBalance(p.id);
        if (draft && draft.played) {
          rawBalances[p.id] = prevBal - draft.buyIn - draft.rebuys + draft.cashOut;
        } else {
          rawBalances[p.id] = prevBal;
        }
      });

      // 3. Calculate projected paydays to distribute
      const paydaysToDistribute = calculatePaydays(Number(dayNumber), config, rawBalances, loans);
      
      const nestedBalances = {};
      const finalLedger = {};

      config.players.forEach(p => {
        const total = rawBalances[p.id] + (paydaysToDistribute[p.id] || 0);
        nestedBalances[p.id] = {
          bank: total,
          wallet: 0
        };

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

      if (editingSessionId) {
        await setDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', editingSessionId), {
          dayNumber:   Number(dayNumber),
          balances:    nestedBalances,
          paydaysDistributed: paydaysToDistribute,
          ledger:      finalLedger,
          recordedAt:  new Date().toISOString(),
          recordedBy:  'host:' + user.uid,
        }, { merge: true });
      } else {
        await addDoc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'sessions'), {
          dayNumber:   Number(dayNumber),
          balances:    nestedBalances,
          paydaysDistributed: paydaysToDistribute,
          ledger:      finalLedger,
          status: 'completed',
          recordedAt:  new Date().toISOString(),
          recordedBy:  'host:' + user.uid,
        });
      }

      // Update central balances document and write transaction logs atomically
      const balancesRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'balances', 'main');
      await runTransaction(db, async (transaction) => {
        config.players.forEach(p => {
          const txRef = doc(collection(db, 'artifacts', safeAppId, 'public', 'data', 'transactions'));
          const amt = nestedBalances[p.id].bank;
          transaction.set(txRef, {
            type: 'BALANCE_RESET',
            from: null,
            to: { playerId: p.id, account: 'bank' },
            amount: amt,
            sessionDay: Number(dayNumber),
            sessionId: null,
            note: `Manual session record balance override: Day ${dayNumber}`,
            recordedAt: new Date().toISOString(),
            recordedBy: 'host:' + user.uid
          });
        });
        transaction.set(balancesRef, nestedBalances);
      });

      setShowSessionModal(false);
    } catch (err) {
      console.error('Error saving session:', err);
      alert('Failed to save session: ' + err.message);
    }
  };

  const deleteSession = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', safeAppId, 'public', 'data', 'sessions', id)); } 
    catch (err) { console.error('Error deleting session:', err); }
  };

  const openLoanModal = () => {
    const loanDay = activeSession ? currentDay : (currentDay + 1);
    setLoanDraft({ borrower: '', lender: '', amount: 0, interest: 10, dayIssued: loanDay, deadlineDay: loanDay + 5 });
    setShowLoanModal(true);
  };

  const saveLoan = async () => {
    if (!user || !loanDraft.borrower || !loanDraft.lender || loanDraft.amount <= 0 || isSubmittingLoan) return;
    setIsSubmittingLoan(true);
    try {
      const activePlayers = activeSession
        ? Object.entries(playerDeclarations || {}).filter(([, d]) => d?.status === 'active').map(([id]) => id)
        : [];
      await recordLoanIssuance(db, safeAppId, loanDraft, loanDraft.dayIssued, 'host:' + user.uid, activePlayers);
      setShowLoanModal(false);
    } catch (err) {
      console.error('Error saving loan:', err);
      alert("Failed to issue loan: " + err.message);
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const toggleLoanStatus = async (loan) => {
    if (!user || isSubmittingLoan) return;
    setIsSubmittingLoan(true);
    try {
      const activePlayers = activeSession
        ? Object.entries(playerDeclarations || {}).filter(([, d]) => d?.status === 'active').map(([id]) => id)
        : [];
      if (loan.status === 'active' || loan.status === 'pending_settlement') {
        await recordLoanSettlement(db, safeAppId, loan, currentDay, 'host:' + user.uid, activePlayers);
      } else {
        alert("Reactivating settled loans is not supported. Create a new loan if needed.");
      }
    } catch (err) {
      console.error('Error updating loan:', err);
      alert("Failed to settle loan: " + err.message);
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const handleReleaseFrozen = async (loan) => {
    if (!user || isSubmittingLoan) return;
    setIsSubmittingLoan(true);
    try {
      await releaseFrozenToLender(db, safeAppId, loan, currentDay, 'host:' + user.uid);
      alert("Frozen funds successfully released to lender!");
    } catch (err) {
      console.error('Error releasing frozen funds:', err);
      alert("Failed to release frozen funds: " + err.message);
    } finally {
      setIsSubmittingLoan(false);
    }
  };

  const getPlayerName = id => config.players.find(p => p.id === id)?.name || id;

  const handleBalanceDraftChange = (playerId, val) => {
    setBalancesDraft(prev => ({ ...prev, [playerId]: val === '' ? '' : Number(val) }));
  };

  const saveBalances = async () => {
    if (!user) return;
    try {
      await saveBalancesLog(db, safeAppId, balancesDraft, config, 'host:' + user.uid);
      alert("Current balances updated successfully!");
    } catch (err) {
      console.error("Error saving balances:", err);
      alert("Failed to save balances: " + err.message);
    }
  };

  const handleBalanceCorrection = async (playerId, delta, note) => {
    if (!user) return;
    try {
      await recordBalanceCorrection(db, safeAppId, playerId, delta, note, currentDay, 'host:' + user.uid);
    } catch (err) {
      console.error("Error applying balance correction:", err);
      alert("Failed to apply correction: " + err.message);
      throw err;
    }
  };

  const handleGlobalReset = async (designatedAmount) => {
    if (!user) return;
    try {
      await globalResetBalancesAndBaselines(db, safeAppId, settingsDraft, designatedAmount, 'host:' + user.uid);
    } catch (err) {
      console.error("Error performing global reset:", err);
      alert("Failed to perform global reset: " + err.message);
    }
  };

  if (loading || !balancesLoaded || !user) {
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
    { id: 'playerDashboard', icon: User, label: 'My Dashboard' },
    { id: 'dashboard',    icon: Trophy,       label: 'Leaderboard' },
    { id: 'stats',        icon: TrendingUp,   label: 'Stats' },
    { id: 'sessions',     icon: CalendarDays, label: 'Accounting' },
    { id: 'loans',        icon: HandCoins,    label: 'Loans' },
    ...(isAuthenticated ? [{ id: 'virtualTable', icon: Dices, label: 'Virtual Table Manager' }] : []),
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
              <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'fill-amber-400/10 text-amber-400' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 flex flex-col gap-2">
          <button
            onClick={() => isAuthenticated ? handleAdminLogout() : setShowPinModal(true)}
            className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl text-xs font-semibold bg-zinc-950 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-zinc-500" />
              <span>{isAuthenticated ? 'Admin Active' : 'Admin Unlock'}</span>
            </span>
            {isAuthenticated ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-zinc-600" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-white/5 flex items-center justify-between px-4 bg-[#09090b]/80 backdrop-blur-md">
          <h1 className="text-lg font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            {config.leagueName}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => isAuthenticated ? handleAdminLogout() : setShowPinModal(true)}
              className={`p-2.5 rounded-xl border transition-all ${
                isAuthenticated 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {isAuthenticated ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </button>
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
                liveGames={liveGames}
                isAuthenticated={isAuthenticated}
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
                activeSession={activeSession}
                playerDeclarations={playerDeclarations}
                sessions={sessions}
                balances={balances}
              />
            )}

            {activeTab === 'stats' && (
              <StatsTab
                config={config}
                sessions={sessions}
                loans={loans}
                playerCurrentStats={playerStats}
              />
            )}
 
            {activeTab === 'sessions' && (
              <AccountingTab
                isAuthenticated={isAuthenticated}
                openSessionModal={openSessionModal}
                sessions={sessions}
                config={config}
                deleteSession={deleteSession}
                activeSession={activeSession}
                onStartDay={handleStartDay}
                onOpenAudit={() => setShowAuditModal(true)}
                playerDeclarations={playerDeclarations}
                transactions={transactions}
              />
            )}
 
            {activeTab === 'loans' && (
              <LoansTab
                isAuthenticated={isAuthenticated}
                openLoanModal={openLoanModal}
                loans={loans}
                currentDay={currentDay}
                toggleLoanStatus={toggleLoanStatus}
                handleReleaseFrozen={handleReleaseFrozen}
                balances={balances}
                getPlayerName={getPlayerName}
                isSubmitting={isSubmittingLoan}
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
                balancesDraft={balancesDraft}
                handleBalanceDraftChange={handleBalanceDraftChange}
                saveBalances={saveBalances}
                handleBalanceCorrection={handleBalanceCorrection}
                handleGlobalReset={handleGlobalReset}
              />
            )}
 
            {activeTab === 'virtualTable' && (
              <VirtualTableTab
                isAuthenticated={isAuthenticated}
                config={config}
                liveGames={liveGames}
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
        editingSessionId={editingSessionId}
        saveSession={saveSession}
        config={config}
        sessions={sessions}
        loans={loans}
        balances={balances}
      />
 
      <LoanModal
        isOpen={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        loanDraft={loanDraft}
        setLoanDraft={setLoanDraft}
        saveLoan={saveLoan}
        config={config}
        isSubmitting={isSubmittingLoan}
      />

      <AuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        activeSession={activeSession}
        config={config}
        sessions={sessions}
        onCommit={handleCommitDay}
        playerDeclarations={playerDeclarations}
        balances={balances}
      />
    </div>
  );
}