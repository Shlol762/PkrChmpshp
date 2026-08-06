import { X, HandCoins, ArrowRightLeft } from 'lucide-react';
import { repaymentAmount } from '../utils/pokerEngine';


export default function LoanModal({
  isOpen,
  onClose,
  loanDraft,
  setLoanDraft,
  saveLoan,
  config,
  isSubmitting = false
}) {
  if (!isOpen) return null;

  const repay = repaymentAmount(loanDraft);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in">
      <div className="bg-[#09090b] sm:bg-zinc-900/90 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col">
        
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-amber-500" /> New Loan
          </h3>
          <button onClick={onClose} className="bg-white/10 text-zinc-300 hover:text-white p-2 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 pb-8 sm:pb-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Issue Day</label>
              <input
                type="number"
                value={loanDraft.dayIssued}
                onChange={e => setLoanDraft({ ...loanDraft, dayIssued: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Deadline</label>
              <input
                type="number"
                value={loanDraft.deadlineDay}
                onChange={e => setLoanDraft({ ...loanDraft, deadlineDay: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-1 bg-zinc-900 p-1.5 rounded-full border border-white/10 z-10">
              <ArrowRightLeft className="w-4 h-4 text-zinc-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-rose-400 mb-2">Borrower</label>
              <select
                value={loanDraft.borrower}
                onChange={e => setLoanDraft({ ...loanDraft, borrower: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-rose-500 appearance-none"
              >
                <option value="" disabled>Select...</option>
                {config.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-emerald-400 mb-2">Lender</label>
              <select
                value={loanDraft.lender}
                onChange={e => setLoanDraft({ ...loanDraft, lender: e.target.value })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white focus:outline-none focus:border-emerald-500 appearance-none"
              >
                <option value="" disabled>Select...</option>
                {config.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Principal</label>
              <input
                type="number"
                min="1"
                value={loanDraft.amount || ''}
                placeholder="0"
                onChange={e => setLoanDraft({ ...loanDraft, amount: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
              />
              {config && Number(config.paydayMax || 0) > 0 && (
                <span className="text-[10px] font-bold text-zinc-500 mt-1 block">
                  Max allowed: {(Number(config.paydayMax || 0)).toLocaleString()}
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">Interest (%)</label>
              <input
                type="number"
                min="0"
                value={loanDraft.interest}
                onChange={e => setLoanDraft({ ...loanDraft, interest: Number(e.target.value) })}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3.5 text-white font-mono text-lg focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {config && Number(config.paydayMax || 0) > 0 && loanDraft.amount > Number(config.paydayMax) && (
            <div className="text-rose-400 text-xs font-semibold text-center border border-rose-500/20 bg-rose-500/10 rounded-xl py-2 px-3 animate-in slide-in-from-top-1">
              Loan amount exceeds the maximum limit of {(Number(config.paydayMax || 0)).toLocaleString()}
            </div>
          )}

          {loanDraft.amount > 0 && (config && Number(config.paydayMax || 0) > 0 ? loanDraft.amount <= Number(config.paydayMax) : true) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex justify-between items-center">
              <span className="text-amber-500/80 text-xs font-bold uppercase tracking-wider">Owed Total</span>
              <span className="font-bold text-amber-400 text-xl tabular-nums">
                {(repay || 0).toLocaleString()}
              </span>
            </div>
          )}

          <button
            onClick={saveLoan}
            disabled={
              !loanDraft.borrower || 
              !loanDraft.lender || 
              loanDraft.borrower === loanDraft.lender || 
              loanDraft.amount <= 0 || 
              (config && Number(config.paydayMax || 0) > 0 && loanDraft.amount > Number(config.paydayMax)) || 
              isSubmitting
            }
            className="w-full py-4 rounded-xl font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? 'Processing...' : 'Issue Loan'}
          </button>
        </div>
      </div>
    </div>
  );
}
