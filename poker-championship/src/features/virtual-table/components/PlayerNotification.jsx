import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, safeAppId } from '../../../firebase';
import { AlertTriangle, Check, Info } from 'lucide-react';

const ICONS = {
  success: <Check className="w-4 h-4 shrink-0" />,
  error: <AlertTriangle className="w-4 h-4 shrink-0" />,
  info: <Info className="w-4 h-4 shrink-0" />,
};

const COLORS = {
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  error: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

export default function PlayerNotification({ currentPlayerId }) {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!currentPlayerId) return;
    const ref = doc(db, 'artifacts', safeAppId, 'public', 'data', 'playerNotifications', currentPlayerId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setNotification(data);
        // Auto-dismiss after 4 seconds
        setTimeout(() => setNotification(null), 4000);
      }
    });
    return () => unsub();
  }, [currentPlayerId]);

  if (!notification) return null;

  const type = notification.type || 'info';
  return (
    <div className={`border rounded-2xl py-3 px-4 flex items-center gap-2.5 text-sm font-semibold animate-in slide-in-from-top-2 duration-300 ${COLORS[type]}`}>
      {ICONS[type]}
      <span>{notification.message}</span>
    </div>
  );
}
