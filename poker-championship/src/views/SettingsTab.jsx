import { useState } from 'react';
import { Lock, Settings, Check, Users, Plus, Trash2, Dices, Sparkles, RotateCcw, Coins } from 'lucide-react';


export default function SettingsTab({
  isAuthenticated,
  setShowPinModal,
  settingsDraft,
  handleConfigChange,
  handlePlayerChange,
  addPlayer,
  removePlayer,
  saveSettings,
  balancesDraft = {},
  handleBalanceDraftChange,
  saveBalances,
  handleBalanceCorrection,
  handleGlobalReset
}) {
  const [resetAmount, setResetAmount] = useState(8300);

  // Balance Correction State
  const [correctionPlayerId, setCorrectionPlayerId] = useState('');
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionSign, setCorrectionSign] = useState('add');
  const [correctionNote, setCorrectionNote] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  const onSubmitCorrection = async (e) => {
    e.preventDefault();
    if (isSubmittingCorrection) return;
    const rawAmt = Number(correctionAmount);
    if (isNaN(rawAmt) || rawAmt <= 0) {
      alert("Please enter a valid positive number for adjustment amount.");
      return;
    }
    const finalDelta = rawAmt * (correctionSign === 'deduct' ? -1 : 1);
    if (window.confirm(`Are you sure you want to apply a balance correction of $${finalDelta.toLocaleString()} to ${correctionPlayerId}?\n\nReason: "${correctionNote}"`)) {
      setIsSubmittingCorrection(true);
      try {
        await handleBalanceCorrection(correctionPlayerId, finalDelta, correctionNote);
        setCorrectionAmount('');
        setCorrectionNote('');
        alert("Balance correction applied successfully!");
      } catch (err) {
        // Error alert is handled in App.jsx helper
      } finally {
        setIsSubmittingCorrection(false);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20 bg-zinc-900/30 border border-white/5 rounded-3xl border-dashed">
        <Lock className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-zinc-300">Settings Locked</h3>
        <p className="text-zinc-500 text-sm mt-1 mb-6">Admin access is required to change rules and roster.</p>
        <button
          onClick={() => setShowPinModal(true)}
          className="bg-amber-500 text-amber-950 font-bold py-2.5 px-6 rounded-xl hover:bg-amber-400 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)]"
        >
          Unlock Controls
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
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
          <span className="hidden sm:inline">Save Settings</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Game Rules Column */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:col-span-1 h-fit">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-blue-400" /> Game Rules
          </h3>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">PayDayMAX Amount</label>
              <input
                type="number"
                value={settingsDraft.paydayMax ?? 0}
                onChange={e => handleConfigChange('paydayMax', e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">PayDay Threshold</label>
              <input
                type="number"
                value={settingsDraft.paydayThreshold ?? 1000}
                onChange={e => handleConfigChange('paydayThreshold', e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Payday Interval (Days)</label>
              <input
                type="number"
                value={settingsDraft.paydayInterval}
                onChange={e => handleConfigChange('paydayInterval', e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Player Roster Column */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" /> Player Roster
            </h3>
            <button
              onClick={addPlayer}
              className="flex items-center gap-1.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-3">
            {settingsDraft.players.map((p, idx) => (
              <div key={p.id} className="flex gap-3 items-center bg-zinc-950/50 p-3 rounded-xl border border-white/5 group">
                <div className="w-10 text-center text-zinc-600 text-xs font-bold shrink-0">{p.id}</div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => handlePlayerChange(idx, 'name', e.target.value)}
                    placeholder="Player Name"
                    className="w-full bg-transparent text-zinc-200 font-medium focus:outline-none"
                  />
                </div>
                <div className="w-28 shrink-0 flex items-center bg-zinc-900 rounded-lg border border-white/5 px-2 focus-within:border-amber-500/50 transition-colors">
                  <span className="text-zinc-500 text-xs">$</span>
                  <input
                    type="number"
                    value={p.startBalance}
                    onChange={e => handlePlayerChange(idx, 'startBalance', e.target.value)}
                    className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none text-right"
                  />
                </div>
                <div className="w-20 shrink-0 flex items-center bg-zinc-900 rounded-lg border border-white/5 px-2 focus-within:border-amber-500/50 transition-colors">
                  <span className="text-zinc-500 text-[10px] font-bold mr-1">PIN</span>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="0000"
                    value={p.pin ?? '0000'}
                    onChange={e => handlePlayerChange(idx, 'pin', e.target.value)}
                    className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none text-center"
                  />
                </div>
                <button
                  onClick={() => removePlayer(idx)}
                  className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Manual Recount / Balance Adjustment Column */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Dices className="w-5 h-5 text-emerald-500" /> Manual Recount / Balance Adjustment
            </h3>
            <button
              onClick={saveBalances}
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <Check className="w-4 h-4" /> Save Balances
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Directly adjust the current physical chip counts. Updates here will overwrite the active totals without modifying historical session data.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {settingsDraft.players.map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-zinc-950/50 p-3 rounded-xl border border-white/5">
                <span className="text-zinc-300 font-medium text-sm">{p.name}</span>
                <div className="w-32 flex items-center bg-zinc-900 rounded-lg border border-white/5 px-2 focus-within:border-emerald-500/50 transition-colors">
                  <span className="text-zinc-500 text-xs">$</span>
                  <input
                    type="number"
                    value={balancesDraft[p.id] ?? ''}
                    onChange={e => handleBalanceDraftChange(p.id, e.target.value)}
                    className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none text-right"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Balance Correction (Delta-based Audit Adjustment) */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 lg:col-span-3">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" /> Apply Balance Correction (Delta)
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mb-6">
            Add or subtract chips for a specific player (e.g., enter <code>4420</code> to add chips, or <code>-2210</code> to deduct). This creates a <strong>BALANCE_CORRECTION</strong> transaction log.
          </p>

          <form onSubmit={onSubmitCorrection} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Select Player</label>
              <select
                value={correctionPlayerId}
                onChange={e => setCorrectionPlayerId(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                required
              >
                <option value="">-- Choose Player --</option>
                {settingsDraft.players.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Amount (Delta)</label>
                <div className="flex items-center bg-zinc-950 border border-white/10 rounded-xl px-2 focus-within:border-amber-500 transition-colors">
                  <span className="text-zinc-500 text-xs">$</span>
                  <input
                    type="number"
                    value={correctionAmount}
                    onChange={e => setCorrectionAmount(e.target.value)}
                    className="w-full bg-transparent p-3 text-white font-mono text-sm focus:outline-none"
                    placeholder="e.g. 4420"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Type</label>
                <select
                  value={correctionSign}
                  onChange={e => setCorrectionSign(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="add">Add (+)</option>
                  <option value="deduct">Deduct (-)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Reason / Note</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={correctionNote}
                  onChange={e => setCorrectionNote(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-700"
                  placeholder="e.g., Refund duplicate buy-ins"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmittingCorrection || !correctionPlayerId || !correctionAmount || !correctionNote}
                  className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-amber-950 px-5 py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0 cursor-pointer"
                >
                  {isSubmittingCorrection ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Global Reset / Start Round 2 Column */}
        <div className="bg-gradient-to-br from-violet-950/20 via-zinc-900/40 to-zinc-900/40 border border-violet-500/20 hover:border-violet-500/30 transition-all rounded-3xl p-6 lg:col-span-3 shadow-[0_0_30px_rgba(139,92,246,0.05)]">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" /> Start Round 2 / Global Reset
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Initialize a new round of the championship. Resets all player active balances & baseline starting balances to the designated amount.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-32 flex items-center bg-zinc-950 rounded-lg border border-white/5 px-2 focus-within:border-violet-500/50 transition-colors">
                <span className="text-zinc-500 text-xs">$</span>
                <input
                  type="number"
                  value={resetAmount}
                  onChange={e => setResetAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent p-2.5 text-white font-mono text-sm focus:outline-none text-right"
                  placeholder="8300"
                />
              </div>
              <button
                onClick={() => {
                  if (resetAmount === '' || isNaN(resetAmount) || Number(resetAmount) <= 0) {
                    alert("Please enter a valid positive number for the reset amount.");
                    return;
                  }
                  if (window.confirm(`⚠️ WARNING: This will reset all active balances and player baseline start balances to $${Number(resetAmount).toLocaleString()} for Round 2.\n\nHistorical session records and loan ledger entries will NOT be deleted.\n\nAre you sure you want to proceed with launching Round 2?`)) {
                    handleGlobalReset(Number(resetAmount));
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.2)] font-mono"
              >
                <RotateCcw className="w-4 h-4" /> Reset for Round 2
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Note: This action immediately writes to Firestore and generates a <strong>BALANCE_RESET</strong> transaction log for all players indicating the transition to Round 2.
          </p>
        </div>
      </div>
    </div>
  );
}
