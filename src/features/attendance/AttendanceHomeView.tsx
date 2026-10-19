import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/useTheme';
import { MyHistoryModal } from './MyHistoryModal';
import {
  History,
  Coins,
  Store as StoreIcon,
  Truck,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';

export const AttendanceHomeView: React.FC = () => {
  const { profile, checkInToday, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!profile) return null;

  const assignedRole = profile.role;
  const isMarketing = assignedRole === 'marketing' || assignedRole === 'sales';
  const isDriver = assignedRole === 'driver' || assignedRole === 'kurir';
  const isDropping = !isMarketing && !isDriver; // Default to dropping

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      const res = await checkInToday();
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
            Halo, {profile.full_name || profile.username}
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

          {/* Logout button */}
          <button
            type="button"
            onClick={async () => {
              const confirmLogout = window.confirm('Keluar dari sesi akun Anda?');
              if (confirmLogout) {
                await logout();
              }
            }}
            className="w-9 h-9 sm:w-auto sm:px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-xs"
            title="Keluar / Logout Akun"
            aria-label="Keluar dari akun"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Main Assignment & Check-in Card */}
      <div className="w-full max-w-sm mx-auto my-auto space-y-4">
        <div className="space-y-3.5">
          {/* Official Assignment Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl dark:shadow-2xl transition-colors">
            {/* Dynamic Role Icon Badge */}
            {isDropping && (
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 mx-auto flex items-center justify-center shadow-md">
                <Coins className="w-8 h-8" />
              </div>
            )}
            {isMarketing && (
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 mx-auto flex items-center justify-center shadow-md">
                <StoreIcon className="w-8 h-8" />
              </div>
            )}
            {isDriver && (
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 mx-auto flex items-center justify-center shadow-md">
                <Truck className="w-8 h-8" />
              </div>
            )}

            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700/60 inline-block mb-2">
                Tugas dari Admin / BM Cabang
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize">
                {isDropping && 'Petugas Dropping'}
                {isMarketing && 'Petugas Marketing'}
                {isDriver && 'Driver Lapangan'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-[280px] mx-auto font-medium leading-relaxed">
                {isDropping && 'Pencocokan angka meteran mesin, penarikan koin omset laci, dan input jatah toko mitra.'}
                {isMarketing && 'Survei calon lokasi mitra, pendaftaran toko baru, dan pengajuan penempatan mesin.'}
                {isDriver && 'Pengiriman unit mesin dari gudang ke toko mitra dan serah terima penempatan.'}
              </p>
            </div>

            {/* Check-In CTA Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCheckIn}
              className={`w-full py-4 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition touch-target cursor-pointer disabled:opacity-60 ${
                isDropping
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/30'
                  : isMarketing
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/30'
              }`}
            >
              <span>{isSubmitting ? 'Mencatat Absensi...' : 'Absen Masuk Sekarang'}</span>
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Log absensi & performa harian Anda</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>
        </div>
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
