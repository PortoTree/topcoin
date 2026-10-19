import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/useTheme';
import { Coins, KeyRound, User, ArrowRight, ShieldCheck, Zap, Sun, Moon } from 'lucide-react';
import type { UserRole } from '../../types';

export const LoginView: React.FC = () => {
  const { loginWithPin, switchDemoRole, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim()) {
      setErrorMsg('Masukkan Username atau No. HP.');
      return;
    }
    if (!pin.trim()) {
      setErrorMsg('Masukkan PIN Anda.');
      return;
    }

    const res = await loginWithPin(identifier, pin);
    if (!res.success) {
      setErrorMsg(res.message || 'Login gagal.');
    }
  };

  const handleQuickDemo = (role: UserRole) => {
    setErrorMsg(null);
    switchDemoRole(role);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-5 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Theme Switcher Bar */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTheme();
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-amber-400 transition-all cursor-pointer shadow-xs active:scale-90"
          title={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
          aria-label={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-700 hover:text-indigo-600 transition-colors" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400/30 transition-colors" />
          )}
        </button>
      </div>

      {/* Top Branding */}
      <div className="pt-2 pb-3 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 p-0.5 shadow-xl shadow-indigo-500/20 mb-3 animate-bounce-subtle">
          <div className="w-full h-full bg-slate-900 dark:bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Coins className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          PCB TOP COIN
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
          Sistem Pendataan Omset & Operasional Multi-Cabang
        </p>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl dark:shadow-2xl">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Masuk Aplikasi</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Gunakan Username / No. HP dan PIN 6-digit Anda
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identifier Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Username atau No. HP
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="misal: owner, bm, admin, marketing..."
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full pl-10 pr-3 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* PIN Input (Numeric Keypad on Mobile) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              PIN Keamanan (6 Digit)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className="w-full pl-10 pr-3 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-lg tracking-widest font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Switcher - 6 Role Matrix */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              1-Tap Demo 6 Peran (Khusus Uji Coba):
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {/* 1. Owner */}
            <button
              type="button"
              onClick={() => handleQuickDemo('owner')}
              className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 rounded-lg text-left transition active:scale-95 cursor-pointer"
            >
              <div className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300">1. Owner (Global)</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">owner • 123456</div>
            </button>

            {/* 2. Branch Manager */}
            <button
              type="button"
              onClick={() => handleQuickDemo('branch_manager')}
              className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg text-left transition active:scale-95 cursor-pointer"
            >
              <div className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300">2. Branch Manager</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">bm • 123456</div>
            </button>

            {/* 3. Admin Cabang */}
            <button
              type="button"
              onClick={() => handleQuickDemo('admin_cabang')}
              className="py-1.5 px-2 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/30 rounded-lg text-left transition active:scale-95 cursor-pointer"
            >
              <div className="text-[11px] font-extrabold text-cyan-700 dark:text-cyan-300">3. Admin Cabang</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">admin • 123456</div>
            </button>

            {/* 4. Marketing */}
            <button
              type="button"
              onClick={() => handleQuickDemo('marketing')}
              className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg text-left transition active:scale-95 cursor-pointer"
            >
              <div className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300">4. Marketing</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">marketing • 123456</div>
            </button>

            {/* 5. Dropping */}
            <button
              type="button"
              onClick={() => handleQuickDemo('dropping')}
              className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 rounded-lg text-left transition active:scale-95 cursor-pointer"
            >
              <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">5. Dropping</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">dropping • 123456</div>
            </button>

            {/* 6. Logistik */}
            <button
              type="button"
              onClick={() => handleQuickDemo('logistik')}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 rounded-lg text-left transition active:scale-95 cursor-pointer"
            >
              <div className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300">6. Logistik</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">logistik • 123456</div>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="py-3 text-center">
        <p className="text-[11px] text-slate-500 dark:text-slate-500 flex items-center justify-center gap-1 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Aman & Terenkripsi • Terhubung ke Supabase
        </p>
      </div>
    </div>
  );
};
