import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';

export default function ManagePlayersModal({ liveGame, config, playerDeclarations, gameDocRef, activeTableId, onClose }) {
  const [addStacks, setAddStacks] = useState({});

  const handleRemove = async (p) => {
    if (!window.confirm(`Remove ${p.name} from this table?`)) return;
    const remaining = liveGame.players.filter(lp => lp.id !== p.id);
    let newDealerIdx = liveGame.dealerIndex;
    let newActingIdx = liveGame.actingPlayerIndex;
    const removedIdx = liveGame.players.findIndex(lp => lp.id === p.id);
    if (newDealerIdx >= remaining.length) newDealerIdx = 0;
    if (newActingIdx === removedIdx) newActingIdx = -1;
    else if (newActingIdx > removedIdx) newActingIdx -= 1;

    const updatedProcessed = { ...(liveGame.processedDeclarations || {}) };
    delete updatedProcessed[p.id];

    await setDoc(gameDocRef, {
      ...liveGame,
      players: remaining,
      dealerIndex: newDealerIdx,
      actingPlayerIndex: newActingIdx,
      processedDeclarations: updatedProcessed,
      history: [...(liveGame.history || []), `[Host Remove] ${p.name} removed from table.`],
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleAdd = async (p) => {
    const dec = playerDeclarations?.[p.id];
    const defaultStack = dec?.buyIn !== undefined ? Number(dec.buyIn) + Number(dec.rebuys || 0) : (p.startBalance || 500);
    const startingStack = Number(addStacks[p.id] ?? defaultStack);
    const isHandRunning = liveGame.stage !== 'SETUP' && liveGame.stage !== 'SHOWDOWN';
    const newPlayer = {
      id: p.id, name: p.name, stack: startingStack,
      currentBet: 0, totalHandInvestment: 0,
      folded: isHandRunning, isAllIn: false, outOfChips: false, hasActed: isHandRunning,
    };
    const updatedPlayers = [...(liveGame.players || []), newPlayer];
    const updatedProcessed = { ...(liveGame.processedDeclarations || {}), [p.id]: { buyIn: startingStack, rebuys: 0 } };
    await setDoc(gameDocRef, {
      ...liveGame,
      players: updatedPlayers,
      processedDeclarations: updatedProcessed,
      history: [...(liveGame.history || []), `[Host Add] ${p.name} added with ${startingStack.toLocaleString()} chips.`],
      lastUpdated: new Date().toISOString(),
    });
  };

  const tableName = activeTableId === 'main' ? 'Table 1' : `Table ${activeTableId.split('_')[1] || activeTableId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl w-full max-w-md space-y-6 shadow-2xl relative">
        <h3 className="text-lg font-bold text-white">Manage Players at {tableName}</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {config.players.map(p => {
            const isAtTable = liveGame?.players?.some(lp => lp.id === p.id);
            const playerObj = liveGame?.players?.find(lp => lp.id === p.id);
            const dec = playerDeclarations?.[p.id];
            const defaultStack = dec?.buyIn !== undefined ? Number(dec.buyIn) + Number(dec.rebuys || 0) : (p.startBalance || 500);
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/40 border border-white/5">
                <div>
                  <span className="text-sm font-semibold text-zinc-200">{p.name}</span>
                  {isAtTable && playerObj && (
                    <span className="text-xs text-zinc-500 block font-mono">Stack: {playerObj.stack.toLocaleString()}</span>
                  )}
                  {!isAtTable && dec?.status === 'active' && (
                    <span className="text-xs text-amber-400 block font-mono">Declared: {(Number(dec.buyIn || 0) + Number(dec.rebuys || 0)).toLocaleString()}</span>
                  )}
                </div>
                {isAtTable ? (
                  <button onClick={() => handleRemove(playerObj)}
                    className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
                    Remove
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="number"
                      value={addStacks[p.id] ?? defaultStack}
                      onChange={e => setAddStacks(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                      className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-right font-mono text-zinc-200 w-16 focus:outline-none" />
                    <button onClick={() => handleAdd(p)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
                      Add
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onClose}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-2xl text-sm transition-colors cursor-pointer">
          Close
        </button>
      </div>
    </div>
  );
}
