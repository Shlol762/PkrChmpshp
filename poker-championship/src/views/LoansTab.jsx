import { useState, useMemo } from 'react';
import { HandCoins, Plus, ArrowRightLeft, AlertCircle, Hourglass, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedCards, setExpandedCards] = useState(() => new Set());

  const toggleCard = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

          // Calculate borrower reliability rating dynamically
          const borrowerLoans = loans.filter(l => 
            l.borrower === loan.borrower &&
            ['active', 'settled', 'defaulted'].includes(l.status)
          );
          const borrowerOnTime = borrowerLoans.filter(l => l.status === 'settled' && Number(l.settledDay) <= Number(l.deadlineDay)).length;
          const borrowerLate = borrowerLoans.filter(l => l.status === 'settled' && Number(l.settledDay) > Number(l.deadlineDay)).length;
          const borrowerDefault = borrowerLoans.filter(l => l.status === 'defaulted').length;
          const borrowerOverdue = borrowerLoans.filter(l => l.status === 'active' && currentDay > Number(l.deadlineDay)).length;

          const borrowerEnded = borrowerOnTime + borrowerLate + borrowerDefault + borrowerOverdue;
          const borrowerReliability = borrowerEnded > 0 
            ? (borrowerOnTime / borrowerEnded) * 100 
            : null;

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

          const isExpanded = expandedCards.has(loan.id);

          return (
            <div 
              key={loan.id} 
              onClick={() => toggleCard(loan.id)}
              className={`border p-5 rounded-2xl flex flex-col relative transition-all cursor-pointer hover:bg-zinc-800/10 ${
                loan.status === 'settled' 
                  ? 'opacity-70 border-white/5 bg-zinc-950/20' 
                  : loan.status === 'defaulted'
                    ? 'border-rose-500/40 shadow-[0_0_15px_rgba(239,68,68,0.05)] bg-rose-500/[0.01]'
                    : isOverdue 
                      ? 'border-rose-500/30' 
                      : 'border-white/10 bg-zinc-900/40'
              }`}
            >
              
              <div className="flex justify-between items-center gap-2 mb-4">
                <div className="flex flex-wrap gap-1.5 items-center">
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

                  {loan.status === 'settled' && !!loan.defaultedDay && (
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
                      Defaulted
                    </div>
                  )}
                  {loan.status === 'settled' && loan.settledDay && loan.deadlineDay && Number(loan.settledDay) > Number(loan.deadlineDay) && (
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                      Late (+{Number(loan.settledDay) - Number(loan.deadlineDay)}d)
                    </div>
                  )}
                  {loan.status === 'settled' && loan.settledDay && loan.deadlineDay && Number(loan.settledDay) === Number(loan.deadlineDay) && (
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-wide">
                      On Deadline
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isAuthenticated && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                  <div className="text-zinc-550 hover:text-zinc-350 p-0.5">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl mb-4 border border-white/5">
                <div className="text-center flex-1">
                  <div className="text-xs text-zinc-500 uppercase font-semibold mb-1">Borrower</div>
                  <div className="font-bold text-rose-400">{getPlayerName(loan.borrower)}</div>
                  {borrowerReliability !== null && (
                    <div className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5" title="Repayment Reliability Rating">
                      Rate: <span className={borrowerReliability >= 90 ? 'text-emerald-400' : borrowerReliability >= 70 ? 'text-zinc-300' : borrowerReliability >= 50 ? 'text-amber-400' : 'text-rose-450'}>{borrowerReliability.toFixed(0)}%</span>
                    </div>
                  )}
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
                    {loan.status === 'settled' ? 'Settled Value' : 'Owed Repayment'}
                  </div>
                  <div className="text-xl font-bold text-white tabular-nums">{repay.toLocaleString()}</div>
                </div>
                <div className="text-xs font-medium text-right text-zinc-450">
                  {loan.status === 'settled' ? (
                    <div className="space-y-0.5">
                      <span className="text-zinc-500 block text-[9px] uppercase font-bold tracking-wider">Settled On</span>
                      <span className="font-mono text-zinc-300">
                        {loan.settledAt ? (
                          new Date(loan.settledAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })
                        ) : (
                          `Day ${loan.settledDay}`
                        )}
                      </span>
                    </div>
                  ) : isDefaulted ? (
                    <span className="text-amber-500 font-bold">Defaulted on Day {loan.defaultedDay || loan.deadlineDay}</span>
                  ) : (
                    <span className={isOverdue ? 'text-rose-450 font-semibold' : 'text-zinc-400'}>
                      Due Day {loan.deadlineDay}
                    </span>
                  )}
                  {isOverdue && !isDefaulted && (
                    <div className="flex items-center justify-end gap-1 font-bold mt-1 uppercase text-[10px] text-rose-400">
                      <AlertCircle className="w-3 h-3"/> Overdue
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3 text-xs text-zinc-400 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4 bg-zinc-950/40 p-3 rounded-xl border border-white/5 font-medium">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Loan Principal</span>
                      <p className="font-mono text-zinc-200 text-sm">{Number(loan.amount).toLocaleString()} chips</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Interest Accrued</span>
                      <p className="font-mono text-emerald-400 text-sm">+{loan.interest}% (+{(repay - Number(loan.amount)).toLocaleString()})</p>
                    </div>
                  </div>

                  <div className="space-y-2 bg-zinc-950/20 p-3 rounded-xl border border-white/5 text-[11px]">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Requested / Created</span>
                      <span className="text-zinc-300">
                        {loan.recordedAt ? (
                          <>
                            {new Date(loan.recordedAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} <span className="text-zinc-500">(Day {loan.dayIssued})</span>
                          </>
                        ) : (
                          `Day ${loan.dayIssued}`
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Repayment Deadline</span>
                      <span className="text-zinc-300">Day {loan.deadlineDay}</span>
                    </div>

                    {loan.status === 'settled' && (
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Settled On</span>
                        <span className="text-zinc-300">
                          {loan.settledAt ? (
                            <>
                              {new Date(loan.settledAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })} <span className="text-zinc-500">(Day {loan.settledDay})</span>
                            </>
                          ) : (
                            `Day ${loan.settledDay}`
                          )}
                        </span>
                      </div>
                    )}

                    {loan.defaultedDay && (
                      <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Defaulted On</span>
                        <span className="text-rose-400">Day {loan.defaultedDay}</span>
                      </div>
                    )}

                    {loan.note && (
                      <div className="space-y-1 pt-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">System / Settlement Notes</span>
                        <p className="text-zinc-400 italic text-[10px] leading-relaxed bg-zinc-950/60 p-2 rounded-lg border border-white/5">{loan.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
