import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export const NetworkStatusBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
        isOnline
          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20'
          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 animate-pulse'
      }`}
    >
      {isOnline ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <Wifi className="w-3.5 h-3.5" />
          <span>Online</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline (Lokal HP)</span>
        </>
      )}
    </div>
  );
};
