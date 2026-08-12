import { useState } from 'react';

export default function SplitTableModal({ liveGame, activeTables, handleSplitTable, onClose }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const toggle = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleConfirm = async () => {
    if (selectedIds.length === 0) { alert('Please select at least 1 player to move.'); return; }
    const nextId = 'table_' + (activeTables.length + 1);
    await handleSplitTable(selectedIds, nextId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl w-full max-w-md space-y-6 shadow-2xl">
        <div>
          <h3 className="text-lg font-bold text-white">Split Table</h3>
          <p className="text-xs text-zinc-500 mt-1">Select players to move to the new table.</p>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {liveGame?.players?.map(p => (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-sm font-semibold transition-all ${
                selectedIds.includes(p.id)
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-950/40 border-white/5 text-zinc-200 hover:border-white/10'
              }`}
            >
              <span>{p.name}</span>
              <span className="font-mono text-xs text-zinc-500">{p.stack.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-2xl text-sm transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleConfirm}
            className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-3 rounded-2xl text-sm transition-all shadow-md cursor-pointer">
            Create Table &amp; Move
          </button>
        </div>
      </div>
    </div>
  );
}
