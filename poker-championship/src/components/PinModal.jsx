import { useState } from 'react';
import { X, Lock, Unlock, Loader2 } from 'lucide-react';


export default function PinModal({ isOpen, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const res = await onLogin(email, password);
    setIsLoading(false);
    if (res.success) {
      setEmail('');
      setPassword('');
      onClose();
    } else {
      setError(res.error || 'Invalid credentials');
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
        <h2 className="text-2xl font-bold text-white mb-2 text-center tracking-tight">Admin Sign In</h2>
        <p className="text-zinc-500 text-sm mb-6 text-center">Enter email & password to unlock controls.</p>

        <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@email.com"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              autoFocus
            />
          </div>

          <div className="relative">
            <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-center text-xs text-rose-400 font-semibold animate-in slide-in-from-top-1">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 rounded-xl font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex justify-center items-center gap-2"
          >
            {isLoading ? (
              <>Signing In <Loader2 className="w-4 h-4 animate-spin" /></>
            ) : (
              <>Unlock <Unlock className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
