import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { BranchSelector } from './BranchSelector';

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
    <div className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2 transition-colors duration-200 space-y-1.5">
      {/* Top Row: Date & Clock */}
      <div className="flex items-center justify-between text-xs">
        {/* Date: Hari, Tanggal/Bulan/Tahun */}
        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span className="capitalize tracking-tight">{dateFormatted}</span>
        </div>

        {/* Realtime Time: HH:mm:ss WIB */}
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-amber-300 font-extrabold font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-xs">
          <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse flex-shrink-0" />
          <span className="tracking-wider">{timeFormatted}</span>
        </div>
      </div>

      {/* Bottom Row: Branch Selector & Scope */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800/70">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Wilayah Cabang:
        </span>
        <BranchSelector />
      </div>
    </div>
  );
};
