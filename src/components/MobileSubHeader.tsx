import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

export const MobileSubHeader: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const dateFormatted = currentTime.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const seconds = String(currentTime.getSeconds()).padStart(2, '0');
  const timeFormatted = `${hours}:${minutes}:${seconds} WIB`;

  return (
    <div className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 transition-colors duration-200">
      {/* Date & Realtime Clock Row */}
      <div className="flex items-center justify-between text-xs">
        {/* Date: Hari, Tanggal/Bulan/Tahun */}
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span className="capitalize tracking-tight">{dateFormatted}</span>
        </div>

        {/* Realtime Time: HH:mm:ss WIB */}
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-amber-300 font-extrabold font-mono text-[11px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
          <Clock className="w-3 h-3 text-amber-500 animate-pulse flex-shrink-0" />
          <span className="tracking-wider">{timeFormatted}</span>
        </div>
      </div>
    </div>
  );
};
