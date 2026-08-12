import { useState } from 'react';
import { Coins, Play, Users } from 'lucide-react';

export default function GameSetupScreen({
  isAuthenticated,
  config,
  sbAmount, setSbAmount,
  bbAmount, setBbAmount,
  initialDealerId, setInitialDealerId,
  handleStartGame,
  handleOpenLobby,
  liveGame,
}) {
  const [selectedMode, setSelectedMode] = useState('chips_only');

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" /> Virtual Table Manager
          </h2>
          <p className="text-sm text-zinc-500 mt-1">Host a turn-by-turn digital poker game with virtual chips.</p>
        </div>
        <div className="text-center py-16 bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
          <Coins className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">No Active Live Game</h3>
          <p className="text-zinc-500 text-sm mt-2 max-w-md mx-auto">
            No live game is running. To host a game, unlock Admin Controls in the top bar.
          </p>
        </div>
      </div>
    );
  }

  const joinedPlayers = liveGame?.players || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-500" /> Virtual Table Manager
        </h2>
        <p className="text-sm text-zinc-500 mt-1">Configure a new table session below.</p>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl space-y-6">
        <h3 className="text-md font-bold text-zinc-200 border-b border-white/5 pb-3">
          {liveGame ? 'Lobby Waiting Room' : 'New Session Setup'}
        </h3>

        {/* Play Mode selector */}
        <div>
          <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-3 block">Play Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'chips_only', label: '🃏 Virtual Chips', desc: 'Physical cards, digital chip tracking' },
              { id: 'full_digital', label: '💻 Fully Digital', desc: 'Digital cards AND digital chips' },
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedMode === mode.id
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="text-sm font-bold text-zinc-200">{mode.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Joined Players Roster */}
        <div>
          <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1.5 mb-3">
            <Users className="w-3.5 h-3.5" /> Joined Players
          </label>
          {joinedPlayers.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-xs italic bg-zinc-950/40 rounded-2xl border border-white/5">
              {liveGame
                ? 'Lobby is open! Waiting for players to click "Join Table" on their dashboards...'
                : 'Click "Open Lobby" below to start accepting players.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {joinedPlayers.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30"
                >
                  <span className="text-sm font-semibold text-emerald-300">{p.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400">
                    {(p.stack || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blinds & Dealer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Small Blind</label>
            <input
              type="number"
              value={sbAmount}
              onChange={e => setSbAmount(Number(e.target.value))}
              className="bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 px-4 text-zinc-200 font-mono font-semibold w-full focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Big Blind</label>
            <input
              type="number"
              value={bbAmount}
              onChange={e => setBbAmount(Number(e.target.value))}
              className="bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 px-4 text-zinc-200 font-mono font-semibold w-full focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Dealer Button</label>
            <select
              value={initialDealerId}
              onChange={e => setInitialDealerId(e.target.value)}
              className="bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 px-4 text-zinc-200 text-sm font-semibold w-full focus:outline-none focus:border-amber-500"
            >
              <option value="" disabled>Select Player</option>
              {(joinedPlayers.length > 0 ? joinedPlayers : config.players).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        {!liveGame ? (
          <button
            onClick={() => handleOpenLobby(selectedMode)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer text-base shadow-[0_0_20px_rgba(37,99,235,0.25)]"
          >
            <Users className="h-5 w-5" />
            Open Lobby
          </button>
        ) : (
          <button
            onClick={() => handleStartGame(selectedMode)}
            disabled={joinedPlayers.length < 2}
            className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-3.5 px-6 rounded-2xl transition-all shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            <Play className="h-5 w-5 fill-amber-950" />
            Start Hand ({joinedPlayers.length} Seated)
          </button>
        )}
      </div>
    </div>
  );
}
