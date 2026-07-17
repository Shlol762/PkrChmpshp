import { useState, useMemo } from 'react';
import { HandCoins, Plus, ArrowRightLeft, AlertCircle, Hourglass } from 'lucide-react';
import { repaymentAmount } from '../utils/pokerEngine';


export default function LoansTab({
  isAuthenticated,
  openLoanModal,
  loans,
  currentDay,
  toggleLoanStatus,
  handleReleaseFrozen,
  balances = {},
  getPlayerName,
  isSubmitting = false
}) {
  const activeRound = currentDay > 30 ? 2 : 1;
  const [selectedRound, setSelectedRound] = useState(activeRound);

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const lDay = Number(loan.dayIssued || 0);
      return selectedRound === 2 ? lDay > 30 : lDay <= 30;
    });
  }, [loans, selectedRound]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
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

      <div className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Loan Ledger</h2>
          <p className="text-sm text-zinc-500">Track player-to-player debts.</p>
        </div>
        {isAuthenticated && selectedRound === activeRound && (
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
        {filteredLoans.length === 0 && (
           <div className="col-span-full text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed">
            <HandCoins className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-300">No active loans</h3>
            <p className="text-zinc-500 text-sm mt-1">Player debts will appear here.</p>
          </div>
        )}
        {filteredLoans.map(loan => {
          const isOverdue = currentDay > Number(loan.deadlineDay) && loan.status === 'active';
          const repay = repaymentAmount(loan);
          const isDefaulted = loan.status === 'defaulted';

          // Calculate allocated portion of the shared frozen balance for this loan (FIFO order)
          let loanFrozen = 0;
          if (isDefaulted) {
            const borrowerDefaultedLoans = loans.filter(l => l.status === 'defaulted' && l.borrower === loan.borrower)
              .sort((a, b) => {
                const timeA = a.recordedAt || '';
                const timeB = b.recordedAt || '';
                if (timeA !== timeB) return timeA.localeCompare(timeB);
                return a.id.localeCompare(b.id);
              });

            let allocated = Number(balances?.[loan.borrower]?.frozen || 0);
            for (const dl of borrowerDefaultedLoans) {
              const rep = repaymentAmount(dl);
              const dlFrozen = Math.min(rep, allocated);
              allocated -= dlFrozen;
              if (dl.id === loan.id) {
                loanFrozen = dlFrozen;
                break;
              }
            }
          }

          return (
            <div key={loan.id} className={`bg-zinc-900/40 border p-5 rounded-2xl flex flex-col relative transition-all ${
              loan.status === 'settled' 
                ? 'opacity-60 border-white/5' 
                : loan.status === 'defaulted'
                  ? 'border-rose-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)] bg-rose-500/[0.01]'
                  : isOverdue 
                    ? 'border-rose-500/30' 
                    : 'border-white/10'
            }`}>
              
              <div className="flex justify-between items-start mb-4">
                <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                  loan.status === 'active' 
                    ? 'bg-amber-500/10 text-amber-500' 
                    : loan.status === 'pending_settlement'
                      ? 'bg-blue-500/10 text-blue-400'
                      : loan.status === 'defaulted'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {loan.status === 'active' 
                    ? 'Active' 
                    : loan.status === 'pending_settlement'
                      ? 'Pending Settle'
                      : loan.status === 'defaulted'
                        ? 'Defaulted'
                        : 'Settled'}
                </div>
                {isAuthenticated && (
                  <div className="flex gap-2">
                    {loan.status === 'defaulted' && (balances?.[loan.borrower]?.frozen || 0) > 0 && (
                      <button
                        onClick={() => handleReleaseFrozen(loan)}
                        disabled={isSubmitting}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-55 disabled:cursor-not-allowed bg-orange-600 hover:bg-orange-500 text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Hourglass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} /> Release
                      </button>
                    )}
                    {(loan.status === 'active' || loan.status === 'pending_settlement') && (
                      <button
                        onClick={() => toggleLoanStatus(loan)}
                        disabled={isSubmitting}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-55 disabled:cursor-not-allowed bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 cursor-pointer"
                      >
                        {isSubmitting ? 'Processing...' : 'Settle'}
                      </button>
                    )}
                  </div>
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

              {loan.status === 'defaulted' && (
                <div className="bg-zinc-950/40 border border-white/5 p-3 rounded-xl mb-4">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">
                    <span>Frozen Assets Progress</span>
                    <span className="text-amber-400 font-mono">{loanFrozen.toLocaleString()} / {repay.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (loanFrozen / repay) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mt-auto pt-2">
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
                    {Number(loan.amount).toLocaleString()} @ {loan.interest}% (+{(repay - Number(loan.amount)).toLocaleString()})
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mb-0.5">Owed Repayment</div>
                  <div className="text-xl font-bold text-white tabular-nums">{repay.toLocaleString()}</div>
                </div>
                <div className={`text-xs font-medium text-right ${isOverdue || isDefaulted ? 'text-rose-400' : 'text-zinc-400'}`}>
                  {isDefaulted ? (
                    <span className="text-amber-500 font-bold">Defaulted on Day {loan.defaultedDay || loan.deadlineDay}</span>
                  ) : (
                    <>Due Day {loan.deadlineDay}</>
                  )}
                  {isOverdue && !isDefaulted && <div className="flex items-center justify-end gap-1 font-bold mt-1 uppercase text-[10px]"><AlertCircle className="w-3 h-3"/> Overdue</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
