import { HandCoins, Plus, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { repaymentAmount } from '../utils/pokerEngine';


export default function LoansTab({
  isAuthenticated,
  openLoanModal,
  loans,
  currentDay,
  toggleLoanStatus,
  getPlayerName,
  isSubmitting = false
}) {
  return (
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
                    disabled={isSubmitting}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-55 disabled:cursor-not-allowed ${
                      loan.status === 'active'
                        ? 'bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400'
                        : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {isSubmitting ? 'Processing...' : (loan.status === 'active' ? 'Settle' : 'Re-open')}
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
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">
                    {Number(loan.amount).toLocaleString()} @ {loan.interest}% (+{(repay - Number(loan.amount)).toLocaleString()})
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mb-0.5">Owed Repayment</div>
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
  );
}
