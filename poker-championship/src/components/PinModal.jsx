import { useState } from 'react';
import { X, Lock, Unlock, Loader2, User, KeyRound } from 'lucide-react';

export default function PinModal({ isOpen, onClose, config, onPlayerLogin, onAdminLogin }) {
  const [isPlayerMode, setIsPlayerMode] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [pin, setPin] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isPlayerMode) {
        if (!selectedPlayerId) {
          setError('Please select your name.');
          setIsLoading(false);
          return;
        }
        if (pin.length !== 4) {
          setError('PIN must be 4 digits.');
          setIsLoading(false);
          return;
        }
        const res = await onPlayerLogin(selectedPlayerId, pin);
        if (res.success) {
          setPin('');
          onClose();
        } else {
          setError(res.error || 'Incorrect PIN');
        }
      } else {
        const res = await onAdminLogin(email, password);
        if (res.success) {
          setEmail('');
          setPassword('');
          onClose();
        } else {
          setError(res.error || 'Invalid credentials');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 p-6 sm:p-8 rounded-3xl w-full max-w-sm flex flex-col items-center shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

        {onClose && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="bg-gradient-to-br from-amber-400 to-orange-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)] mb-5 z-10 animate-pulse">
          {isPlayerMode ? <User className="h-8 w-8 text-white" /> : <Lock className="h-8 w-8 text-white" />}
        </div>

        <h2 className="text-2xl font-bold text-white mb-1 text-center tracking-tight z-10">
          {isPlayerMode ? 'Player Access' : 'Admin Sign In'}
        </h2>
        <p className="text-zinc-500 text-xs mb-6 text-center max-w-[240px] z-10">
          {isPlayerMode 
            ? 'Select your name and enter your secret PIN.' 
            : 'Enter email & password to unlock Host controls.'}
        </p>

        {/* Mode Toggle Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded-xl w-full mb-6 border border-white/5 z-10">
          <button
            type="button"
            onClick={() => { setIsPlayerMode(true); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              isPlayerMode 
                ? 'bg-zinc-800 text-amber-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Player PIN
          </button>
          <button
            type="button"
            onClick={() => { setIsPlayerMode(false); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              !isPlayerMode 
                ? 'bg-zinc-800 text-amber-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Admin Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4 z-10">
          {isPlayerMode ? (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5 tracking-wider">Select Player</label>
                <select
                  required
                  value={selectedPlayerId}
                  onChange={(e) => { setSelectedPlayerId(e.target.value); setError(''); }}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" disabled>Choose your name...</option>
                  {config?.players?.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5 tracking-wider">4-Digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-center text-xl font-bold font-mono tracking-widest text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5 tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5 tracking-wider">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-center text-xs text-rose-400 font-semibold animate-in slide-in-from-top-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 rounded-xl font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex justify-center items-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>Unlocking... <Loader2 className="w-4 h-4 animate-spin" /></>
            ) : (
              <>Unlock App <Unlock className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
