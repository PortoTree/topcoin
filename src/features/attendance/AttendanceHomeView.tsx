import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/useTheme';
import { MyHistoryModal } from './MyHistoryModal';
import {
  CalendarCheck,
  History,
  Coins,
  Store as StoreIcon,
  Truck,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Sun,
  Moon,
} from 'lucide-react';

export const AttendanceHomeView: React.FC = () => {
  const { profile, checkInToday } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!profile) return null;

  const handleSelectRole = async (chosenRole: 'dropping' | 'marketing' | 'driver') => {
    setIsSubmitting(true);
    try {
      const res = await checkInToday(chosenRole);
      if (!res.success) {
        alert(res.message || 'Gagal menyimpan absensi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-5 transition-colors duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            PCB TOP COIN OPERASIONAL
          </span>
          <h1 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            Halo, {profile.username}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{todayFormatted}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Icon-only Single Theme Switcher */}
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
      </div>

      {/* Main Choice Card */}
      <div className="w-full max-w-sm mx-auto my-auto space-y-4">
        {!showRoleSelector ? (
          <div className="space-y-3.5">
            {/* Absen Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-3 shadow-xl dark:shadow-2xl transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 mx-auto flex items-center justify-center shadow-md">
                <CalendarCheck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Mulai Kerja Hari Ini</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-[260px] mx-auto font-medium">
                  Silakan absen dan tentukan peran tugas Anda untuk hari kerja ini.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRoleSelector(true)}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 active:scale-[0.98] transition touch-target cursor-pointer"
              >
                <span>Absen Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Riwayat Card */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="w-full py-4 px-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-left flex items-center justify-between shadow-xs transition active:scale-[0.99] touch-target cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lihat Riwayat Saya</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Log absensi, dropping, marketing, driver</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </button>
          </div>
        ) : (
          /* Role Selection Cards */
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="text-center pb-1">
              <h2 className="text-base font-black text-slate-900 dark:text-white">Pilih Role Tugas Anda</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                Peran ini akan aktif untuk hari ini sampai jam reset (07:00).
              </p>
            </div>

            {/* 1. Dropping Role */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectRole('dropping')}
              className="w-full p-4 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left flex items-center gap-3.5 shadow-xs transition active:scale-[0.98] group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
                <Coins className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                    Dropping
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
                    Koleksi Omset
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                  Koleksi koin laci mesin, verifikasi meteran odometer, input jatah toko & foto bukti.
                </p>
              </div>
            </button>

            {/* 2. Marketing Role */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectRole('marketing')}
              className="w-full p-4 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 rounded-2xl text-left flex items-center gap-3.5 shadow-xs transition active:scale-[0.98] group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
                <StoreIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300">
                    Marketing
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
                    Pendaftaran Toko
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                  Pendaftaran outlet mitra baru, penguncian koordinat GPS akurat & foto depan toko.
                </p>
              </div>
            </button>

            {/* 3. Driver Role */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectRole('driver')}
              className="w-full p-4 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl text-left flex items-center gap-3.5 shadow-xs transition active:scale-[0.98] group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300">
                    Driver
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                    Logistik Mesin
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                  Eksekusi tugas: pasang mesin baru, relokasi unit, tarik unit rusak & antar stok koin.
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowRoleSelector(false)}
              className="w-full py-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition font-bold cursor-pointer"
            >
              ← Kembali ke Menu Sebelumnya
            </button>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="py-4 text-center">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1 font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
          Sesi aktif terkunci otomatis sampai jam reset harian (07:00)
        </p>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <MyHistoryModal
          userId={profile.id}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};
