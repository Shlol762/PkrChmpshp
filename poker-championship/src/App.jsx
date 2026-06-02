import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Trophy, Users, CalendarDays, Banknote, Plus, Check, X, HandCoins, ArrowRightLeft } from 'lucide-react';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'poker-championship-app';

// Hardcoded initial configuration based on your CSV structure
const PLAYERS = [
  { id: 'AD', name: 'Adi', startBalance: 8300 },
  { id: 'AV', name: 'Advik', startBalance: 8300 },
  { id: 'AK', name: 'Aniket', startBalance: 8300 },
  { id: 'AS', name: 'Anish', startBalance: 8300 },
  { id: 'AR', name: 'Anurag', startBalance: 8300 },
  { id: 'DH', name: 'Dhruv', startBalance: 8300 },
  { id: 'ET', name: 'Ethan', startBalance: 8300 },
  { id: 'GV', name: 'Govind', startBalance: 8300 },
  { id: 'LR', name: 'Leroy', startBalance: 8300 },
  { id: 'MT', name: 'Matha', startBalance: 8300 },
  { id: 'RD', name: 'Riddhi', startBalance: 8300 },
  { id: 'SK', name: 'Shlok', startBalance: 8300 },
  { id: 'SD', name: 'Sidharth', startBalance: 8300 },
  { id: 'TN', name: 'Tanav', startBalance: 8300 },
  { id: 'VN', name: 'Vishnu', startBalance: 8300 },
  { id: 'VG', name: 'Vignesh', startBalance: 8300 },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Data State
  const [sessions, setSessions] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionDraft, setSessionDraft] = useState({});

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanDraft, setLoanDraft] = useState({ borrower: '', lender: '', amount: 0, interest: 10, date: new Date().toISOString().split('T')[0] });

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Data Fetching ---
  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions');
    const loansRef = collection(db, 'artifacts', appId, 'public', 'data', 'loans');

    const unsubSessions = onSnapshot(sessionsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date descending
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setSessions(data);
      setLoading(false);
    }, (err) => console.error("Session fetch error:", err));

    const unsubLoans = onSnapshot(loansRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setLoans(data);
    }, (err) => console.error("Loan fetch error:", err));

    return () => {
      unsubSessions();
      unsubLoans();
    };
  }, [user]);

  // --- 3. Derived Data (Leaderboard Calculations) ---
  const playerStats = useMemo(() => {
    // 1. Calculate Base stats (P/L and Loans)
    let baseStats = PLAYERS.map(player => {
      let totalPL = 0;
      
      // Calculate Total P/L from sessions
      sessions.forEach(session => {
        if (session.results && session.results[player.id]) {
          totalPL += Number(session.results[player.id]);
        }
      });

      // Calculate Loan Impacts
      let lentOut = 0;
      let borrowed = 0;
      
      loans.forEach(loan => {
        if (loan.status === 'active') {
          if (loan.lender === player.id) lentOut += Number(loan.amount);
          if (loan.borrower === player.id) borrowed += Number(loan.amount);
        }
      });

      return { ...player, totalPL, lentOut, borrowed };
    });

    // 2. Calculate Base System Net Worth (before salary)
    // Since loans cancel out across the system (one player's debt is another's asset), 
    // the system base net worth is just sum of startBalances + P/L
    let baseSystemNW = baseStats.reduce((sum, p) => sum + p.startBalance + p.totalPL, 0);

    // 3. Calculate Pay Day Salary
    const MAX_SYSTEM_NW = 200 * 8300; // 1,660,000 maximum cap
    const SALARY_AMOUNT = 3320;
    const PAYDAY_INTERVAL = 5;
    
    const numPaydays = Math.floor(sessions.length / PAYDAY_INTERVAL);
    
    let totalSalaryPerPlayer = 0;
    let currentSystemNW = baseSystemNW;

    for (let i = 0; i < numPaydays; i++) {
      const paydayCost = PLAYERS.length * SALARY_AMOUNT;
      if (currentSystemNW + paydayCost <= MAX_SYSTEM_NW) {
        totalSalaryPerPlayer += SALARY_AMOUNT;
        currentSystemNW += paydayCost;
      } else if (currentSystemNW < MAX_SYSTEM_NW) {
        // Partial salary to exactly hit the cap
        const remaining = MAX_SYSTEM_NW - currentSystemNW;
        const partialSalary = Math.floor(remaining / PLAYERS.length);
        totalSalaryPerPlayer += partialSalary;
        currentSystemNW += (partialSalary * PLAYERS.length);
        break;
      } else {
        break; // Cap already reached
      }
    }

    // 4. Apply Salary and calculate finals
    return baseStats.map(p => {
      const currentBalance = p.startBalance + p.totalPL + totalSalaryPerPlayer;
      const netWorth = currentBalance + p.lentOut - p.borrowed; // Real money footprint

      return {
        ...p,
        salary: totalSalaryPerPlayer,
        currentBalance,
        netWorth
      };
    }).sort((a, b) => b.currentBalance - a.currentBalance);
  }, [sessions, loans]);

  // System Aggregates for UI displays
  const MAX_SYSTEM_NW = 200 * 8300;
  const systemNetWorth = playerStats.reduce((sum, p) => sum + p.netWorth, 0);
  const salaryPerPlayer = playerStats[0]?.salary || 0;
  const nextPaydayIn = 5 - (sessions.length % 5);
  const totalPaydays = Math.floor(sessions.length / 5);

  // --- 4. Handlers ---
  const openSessionModal = () => {
    // Initialize draft with 0s
    const draft = {};
    PLAYERS.forEach(p => draft[p.id] = 0);
    setSessionDraft(draft);
    setSessionDate(new Date().toISOString().split('T')[0]);
    setShowSessionModal(true);
  };

  const handleSessionDraftChange = (playerId, val) => {
    setSessionDraft(prev => ({ ...prev, [playerId]: val === '' ? '' : Number(val) }));
  };

  const saveSession = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), {
        date: sessionDate,
        results: sessionDraft,
        recordedAt: new Date().toISOString(),
        recordedBy: user.uid
      });
      setShowSessionModal(false);
    } catch (err) {
      console.error("Error saving session:", err);
    }
  };

  const deleteSession = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', id));
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const saveLoan = async () => {
    if (!user || !loanDraft.borrower || !loanDraft.lender || loanDraft.amount <= 0) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
        ...loanDraft,
        status: 'active',
        recordedAt: new Date().toISOString(),
        recordedBy: user.uid
      });
      setShowLoanModal(false);
      setLoanDraft({ borrower: '', lender: '', amount: 0, interest: 10, date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      console.error("Error saving loan:", err);
    }
  };

  const toggleLoanStatus = async (loanId, currentStatus) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', loanId), {
        status: currentStatus === 'active' ? 'settled' : 'active',
        settledAt: currentStatus === 'active' ? new Date().toISOString() : null
      });
    } catch (err) {
      console.error("Error updating loan:", err);
    }
  };

  const getPlayerName = (id) => PLAYERS.find(p => p.id === id)?.name || id;

  // --- Helper UI Components ---
  const netSessionPL = Object.values(sessionDraft).reduce((sum, val) => sum + (Number(val) || 0), 0);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="animate-pulse flex flex-col items-center">
          <Trophy className="h-12 w-12 text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold">Loading Championship Table...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <Trophy className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Poker Championship Tracker</h1>
              <p className="text-xs text-slate-400">16 Players • Real-time Balances</p>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="flex space-x-1 mt-4 sm:mt-0 bg-slate-800 p-1 rounded-lg">
            {[
              { id: 'dashboard', icon: Trophy, label: 'Leaderboard' },
              { id: 'sessions', icon: CalendarDays, label: 'Daily P/L' },
              { id: 'loans', icon: HandCoins, label: 'Loans' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* --- TAB: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Current Standings</h2>
                <p className="text-sm text-slate-400">Calculated based on {sessions.length} sessions.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md flex flex-col">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">System Net Worth</span>
                  <span className="font-mono text-emerald-400 font-medium">
                    {systemNetWorth.toLocaleString()} <span className="text-slate-500">/ {MAX_SYSTEM_NW.toLocaleString()}</span>
                  </span>
                </div>
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md flex flex-col">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Salary Paid (Per Player)</span>
                  <span className="font-mono text-blue-400 font-medium">
                    +{salaryPerPlayer.toLocaleString()} <span className="text-slate-500">({totalPaydays} paydays)</span>
                  </span>
                </div>
                <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-md flex flex-col">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Next Payday In</span>
                  <span className="font-mono text-purple-400 font-medium">
                    {systemNetWorth >= MAX_SYSTEM_NW ? 'Maxed Out' : `${nextPaydayIn} session${nextPaydayIn > 1 ? 's' : ''}`}
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
                    <th className="px-6 py-4 font-semibold text-right">Start Bal.</th>
                    <th className="px-6 py-4 font-semibold text-right">Net P/L</th>
                    <th className="px-6 py-4 font-semibold text-right text-blue-400">Salary</th>
                    <th className="px-6 py-4 font-semibold text-right">Active Debt</th>
                    <th className="px-6 py-4 font-semibold text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {playerStats.map((stat, index) => (
                    <tr 
                      key={stat.id} 
                      className={`hover:bg-slate-800/50 transition-colors ${stat.name === 'Shlok' ? 'bg-indigo-900/10' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index === 1 ? 'bg-slate-400/20 text-slate-300' :
                          index === 2 ? 'bg-amber-700/20 text-amber-500' : 'text-slate-500'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{stat.name}</span>
                          {stat.name === 'Shlok' && <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">You</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-400">{stat.startBalance.toLocaleString()}</td>
                      <td className={`px-6 py-4 text-right font-medium ${stat.totalPL > 0 ? 'text-emerald-400' : stat.totalPL < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {stat.totalPL > 0 ? '+' : ''}{stat.totalPL.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-blue-400 font-mono">
                        +{stat.salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {stat.borrowed > 0 && <span className="text-red-400 text-xs block">Owes: {stat.borrowed}</span>}
                        {stat.lentOut > 0 && <span className="text-emerald-400 text-xs block">Owed: {stat.lentOut}</span>}
                        {stat.borrowed === 0 && stat.lentOut === 0 && <span className="text-slate-600">-</span>}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-lg text-white">
                        {stat.currentBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB: SESSIONS --- */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Daily Results (P/L)</h2>
                <p className="text-sm text-slate-400">Record daily profits and losses here.</p>
              </div>
              <button 
                onClick={openSessionModal}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add Day
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
                <CalendarDays className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300">No sessions recorded</h3>
                <p className="text-slate-500">Add the first day's results to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sessions.map(session => {
                  const playersInSession = Object.entries(session.results).filter(([_, val]) => val !== 0);
                  
                  return (
                    <div key={session.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col">
                      <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider block mb-1">Session</span>
                          <h3 className="text-lg font-bold text-white">{new Date(session.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</h3>
                        </div>
                        <button 
                          onClick={() => { if(window.confirm('Delete this session?')) deleteSession(session.id) }}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          title="Delete Session"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto max-h-[200px] pr-2 space-y-2">
                        {playersInSession.length === 0 && <p className="text-sm text-slate-500 italic">No activity recorded.</p>}
                        {playersInSession.sort((a,b) => b[1] - a[1]).map(([id, val]) => (
                          <div key={id} className="flex justify-between items-center text-sm">
                            <span className="text-slate-300">{getPlayerName(id)}</span>
                            <span className={`font-mono font-medium ${val > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {val > 0 ? '+' : ''}{val}
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

        {/* --- TAB: LOANS --- */}
        {activeTab === 'loans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Loan Ledger</h2>
                <p className="text-sm text-slate-400">Track borrowing and interest between players.</p>
              </div>
              <button 
                onClick={() => setShowLoanModal(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-5 w-5" />
                Record Loan
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Details</th>
                    <th className="px-6 py-4 font-semibold">Amount & Rate</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loans.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">
                        No loans recorded yet.
                      </td>
                    </tr>
                  )}
                  {loans.map(loan => (
                    <tr key={loan.id} className={`hover:bg-slate-800/50 transition-colors ${loan.status === 'settled' ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(loan.date).toLocaleDateString()}
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
                        <div className="text-xs text-slate-500">@ {loan.interest}% interest</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          loan.status === 'active' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {loan.status === 'active' ? 'Active' : 'Settled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleLoanStatus(loan.id, loan.status)}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}
      
      {/* Session Entry Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 rounded-t-2xl z-10">
              <div>
                <h3 className="text-xl font-bold text-white">Record Day's Results</h3>
                <p className="text-sm text-slate-400">Enter the final Profit/Loss for each player.</p>
              </div>
              <button onClick={() => setShowSessionModal(false)} className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                <input 
                  type="date" 
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-slate-300">Player Net (P/L)</h4>
                  <div className={`text-sm px-3 py-1 rounded-full font-mono ${netSessionPL === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    Sum: {netSessionPL} {netSessionPL !== 0 && '(Should usually be 0)'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PLAYERS.map(p => (
                    <div key={p.id} className="relative">
                      <label className="absolute -top-2 left-2 bg-slate-950 px-1 text-[10px] text-slate-400 uppercase font-semibold">
                        {p.name}
                      </label>
                      <input 
                        type="number"
                        value={sessionDraft[p.id] === 0 ? '' : sessionDraft[p.id]}
                        placeholder="0"
                        onChange={(e) => handleSessionDraftChange(p.id, e.target.value)}
                        className={`w-full bg-slate-900 border rounded-lg p-3 pt-4 text-white font-mono focus:outline-none transition-colors ${
                          Number(sessionDraft[p.id] || 0) > 0 ? 'border-emerald-500/50 text-emerald-400' :
                          Number(sessionDraft[p.id] || 0) < 0 ? 'border-red-500/50 text-red-400' : 'border-slate-800'
                        }`}
                      />
                    </div>
                  ))}
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
                  Save Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loan Entry Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-emerald-500" />
                Record Loan
              </h3>
              <button onClick={() => setShowLoanModal(false)} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800 transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                <input 
                  type="date" 
                  value={loanDraft.date}
                  onChange={(e) => setLoanDraft({...loanDraft, date: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Borrower</label>
                  <select 
                    value={loanDraft.borrower}
                    onChange={(e) => setLoanDraft({...loanDraft, borrower: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500/50"
                  >
                    <option value="" disabled>Select...</option>
                    {PLAYERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Lender</label>
                  <select 
                    value={loanDraft.lender}
                    onChange={(e) => setLoanDraft({...loanDraft, lender: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="" disabled>Select...</option>
                    {PLAYERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
                  <input 
                    type="number"
                    min="1"
                    value={loanDraft.amount || ''}
                    onChange={(e) => setLoanDraft({...loanDraft, amount: Number(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Interest (%)</label>
                  <input 
                    type="number"
                    min="0"
                    value={loanDraft.interest}
                    onChange={(e) => setLoanDraft({...loanDraft, interest: Number(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

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