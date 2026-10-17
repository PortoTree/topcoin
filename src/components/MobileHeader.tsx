import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/useTheme';
import { Coins, Sun, Moon } from 'lucide-react';

export const MobileHeader: React.FC = () => {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();

  if (!profile) return null;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        {/* Brand & Clean Username */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-wide">
              PCB TOP COIN
            </h1>
            {/* Pure username without extra text or role badge */}
            <p className="text-xs text-slate-700 dark:text-slate-300 font-bold font-mono tracking-tight">
              {profile.username}
            </p>
          </div>
        </div>

        {/* Right Action: Crystal-Clear Segmented Theme Switch */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTheme('light');
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
            title="Ganti ke Mode Terang"
          >
            <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
            <span>Terang</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTheme('dark');
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-slate-900 text-amber-300 shadow-sm border border-slate-700'
                : 'text-slate-500 hover:text-slate-200 dark:text-slate-400'
            }`}
            title="Ganti ke Mode Gelap"
          >
            <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-indigo-400 fill-indigo-400' : 'text-slate-400'}`} />
            <span>Gelap</span>
          </button>
        </div>
      </div>
    </header>
  );
};
