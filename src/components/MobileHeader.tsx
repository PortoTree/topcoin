import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/useTheme';
import { BranchSelector } from './BranchSelector';
import { Coins, Sun, Moon } from 'lucide-react';

export const MobileHeader: React.FC = () => {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!profile) return null;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2">
        {/* Brand & Location / Branch Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-wide leading-tight truncate">
              PCB TOP COIN
            </h1>
            {/* Lokasi Cabang langsung di bawah judul */}
            <div className="mt-0.5">
              <BranchSelector />
            </div>
          </div>
        </div>

        {/* Right Action: Icon-only Single Theme Switcher */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-amber-400 transition-all cursor-pointer shadow-xs active:scale-90 flex-shrink-0"
          title={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
          aria-label={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
        >
          {theme === 'light' ? (
            /* Saat di mode Terang -> icon Bulan (klik untuk switch ke Gelap) */
            <Moon className="w-4 h-4 text-slate-700 hover:text-indigo-600 transition-colors" />
          ) : (
            /* Saat di mode Gelap -> icon Matahari (klik untuk switch ke Terang) */
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400/30 transition-colors" />
          )}
        </button>
      </div>
    </header>
  );
};
