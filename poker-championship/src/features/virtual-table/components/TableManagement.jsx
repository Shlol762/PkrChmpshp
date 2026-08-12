import { useState } from 'react';
import { Users, Power } from 'lucide-react';

export default function TableManagement({
  isAuthenticated,
  config,
  liveGame,
  liveGames,
  activeTables,
  activeTableId,
  playerDeclarations,
  addPlayerStacks, setAddPlayerStacks,
  handleTableSwap,
  gameDocRef,
  onShowManagePlayers,
  onShowSplit,
}) {
  const [movePlayerId, setMovePlayerId] = useState('');
  const [moveTargetTableId, setMoveTargetTableId] = useState('');

  if (!isAuthenticated) return null;

  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 space-y-3">
      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2.5">Table Management</h4>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onShowManagePlayers}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" /> Manage Players
        </button>
        <button
          onClick={onShowSplit}
          disabled={!liveGame || (liveGame.players?.length ?? 0) < 2}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Power className="w-3.5 h-3.5 rotate-45" /> Split Table
        </button>
      </div>

      {activeTables.length > 1 && (
        <div className="pt-2 border-t border-white/5">
          <label className="text-[9px] uppercase font-bold text-zinc-500 mb-1.5 block">Move Player to Table</label>
          <div className="flex gap-2">
            <select
              value={movePlayerId}
              onChange={e => setMovePlayerId(e.target.value)}
              className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-300 text-xs font-semibold flex-1 focus:outline-none"
            >
              <option value="">Select Player</option>
              {liveGame?.players?.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={moveTargetTableId}
              onChange={e => setMoveTargetTableId(e.target.value)}
              className="bg-zinc-950 border border-white/10 rounded-xl py-2 px-3 text-zinc-300 text-xs font-semibold flex-1 focus:outline-none"
            >
              <option value="">Target Table</option>
              {activeTables.filter(t => t.id !== activeTableId).map(t => (
                <option key={t.id} value={t.id}>
                  {t.id === 'main' ? 'Table 1' : `Table ${t.id.split('_')[1] || t.id}`}
                </option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (movePlayerId && moveTargetTableId) {
                  await handleTableSwap(movePlayerId, moveTargetTableId);
                  setMovePlayerId('');
                  setMoveTargetTableId('');
                }
              }}
              className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >Move</button>
          </div>
        </div>
      )}
    </div>
  );
}
