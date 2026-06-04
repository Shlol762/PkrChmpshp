import { useState } from 'react';
import { X, Lock, Unlock } from 'lucide-react';


export default function PinModal({ isOpen, onClose, onLogin, systemPin }) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === systemPin) {
      onLogin();
      setPinInput('');
      onClose();
    } else {
      setError(true);
      setPinInput('');
      setTimeout(() => setError(false), 2000); // clear error after 2s
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm flex flex-col items-center shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full">
          <X className="w-5 h-5" />
        </button>
        <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-6">
          <Lock className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">Admin Access</h2>
        <p className="text-zinc-500 text-sm mb-8 text-center">Enter PIN to unlock controls.</p>

        <form onSubmit={handlePinSubmit} className="w-full">
          <div className="relative mb-6">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className={`w-full bg-zinc-950 border rounded-xl p-4 text-center text-white font-mono text-2xl tracking-[0.5em] focus:outline-none transition-colors ${
                error ? 'border-rose-500/50 bg-rose-500/5 focus:border-rose-500' : 'border-white/10 focus:border-amber-500'
              }`}
              autoFocus
            />
            {error && (
              <p className="absolute -bottom-6 left-0 right-0 text-center text-xs text-rose-400 font-semibold animate-in slide-in-from-top-1">
                Incorrect PIN
              </p>
            )}
          </div>
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex justify-center items-center gap-2"
          >
            Unlock <Unlock className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
