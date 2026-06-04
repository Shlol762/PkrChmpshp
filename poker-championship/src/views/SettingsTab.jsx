import { Lock, Settings, Check, Users, Plus, Trash2 } from 'lucide-react';


export default function SettingsTab({
  isAuthenticated,
  setShowPinModal,
  settingsDraft,
  handleConfigChange,
  handlePlayerChange,
  addPlayer,
  removePlayer,
  saveSettings
}) {
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
          <span className="hidden sm:inline">Save</span>
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Max System Net Worth</label>
              <input
                type="number"
                value={settingsDraft.maxSystemNW}
                onChange={e => handleConfigChange('maxSystemNW', e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Payday Salary Amount</label>
              <input
                type="number"
                value={settingsDraft.salaryAmount}
                onChange={e => handleConfigChange('salaryAmount', e.target.value)}
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
      </div>
    </div>
  );
}
