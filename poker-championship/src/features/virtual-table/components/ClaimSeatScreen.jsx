import { useState } from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, safeAppId, auth } from '../../../firebase';

export default function ClaimSeatScreen({ config, liveGames, setCurrentPlayerId, setIsSpectator }) {
  const [claimPlayerId, setClaimPlayerId] = useState('');
  const [claimPin, setClaimPin] = useState('');
  const [claimError, setClaimError] = useState('');

  const activeTablesPlayerIds = [];
  Object.values(liveGames || {}).forEach(g => {
    if (g?.active && g.players) g.players.forEach(p => activeTablesPlayerIds.push(p.id));
  });
  const selectablePlayers = config.players.filter(p => activeTablesPlayerIds.includes(p.id));

  const handleClaim = async () => {
    if (!claimPlayerId) { setClaimError('Please select a player.'); return; }
    setClaimError('');
    try {
      const claimRef = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerClaims', claimPlayerId);
      await setDoc(claimRef, {
        playerId: claimPlayerId,
        pin: claimPin,
        uid: auth.currentUser?.uid || null,
        timestamp: new Date().toISOString(),
      });
      setCurrentPlayerId(claimPlayerId);
      localStorage.setItem('poker_player_id', claimPlayerId);
      localStorage.setItem('poker_player_pin', claimPin);
    } catch {
      setClaimError('Incorrect PIN. Please ask the host for your PIN.');
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-500 py-8">
      <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl space-y-6 shadow-2xl">
        <div className="text-center">
          <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white tracking-tight">Claim Your Seat</h2>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            Select your name and enter your PIN to control your actions.
          </p>
        </div>

        {claimError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{claimError}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Choose Player</label>
            <select value={claimPlayerId} onChange={e => { setClaimPlayerId(e.target.value); setClaimError(''); }}
              className="bg-zinc-950 border border-white/10 rounded-xl py-2.5 px-4 text-zinc-200 text-sm font-semibold w-full focus:outline-none focus:border-amber-500/50">
              <option value="">Select your name...</option>
              {selectablePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-2 block">Enter Your PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              value={claimPin}
              onChange={e => { setClaimPin(e.target.value.replace(/\D/g, '')); setClaimError(''); }}
              className="bg-zinc-950 border border-white/10 rounded-xl py-2.5 px-4 text-zinc-200 font-mono text-center text-lg tracking-widest w-full focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button onClick={handleClaim}
            className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-3 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] text-sm cursor-pointer">
            Confirm &amp; Unlock Seat
          </button>
          <div className="text-center pt-2">
            <button onClick={() => setIsSpectator(true)}
              className="text-xs text-zinc-500 hover:text-zinc-300 font-medium transition-colors underline underline-offset-4">
              Just view the table (Spectator Mode)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
