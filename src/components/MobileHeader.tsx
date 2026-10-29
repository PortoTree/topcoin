import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/useTheme';
import { useBranch } from '../context/BranchContext';
import { ActionPromptModal } from './ActionPromptModal';
import {
  Sun,
  Moon,
  LogOut,
  Calendar,
  ChevronDown,
  Building2,
  Globe,
  Check,
} from 'lucide-react';

export const MobileHeader: React.FC = () => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentBranch, availableBranches, isGlobalView, setCurrentBranch, setGlobalView } = useBranch();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  if (!profile) return null;

  const canSwitchBranch = profile.role === 'owner' || profile.role === 'branch_manager';

  // Format nama cabang: Bersihkan awalan 'Cabang ' jika ada agar menjadi 'SURABAYA PUSAT' atau 'SURABAYA'
  const rawBranchName = isGlobalView
    ? 'SEMUA CABANG'
    : currentBranch?.name
    ? currentBranch.name.replace(/^Cabang\s+/i, '').trim().toUpperCase()
    : 'TOP COIN';

  const headerTitle = `PCB ${rawBranchName}`;

  // Format tanggal hari ini
  const todayDateFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors duration-200">
        <div className="flex items-center justify-between gap-2">
          {/* Brand & Date Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0 overflow-hidden p-1">
              <img src="/topcoin.png" alt="PCB TOP COIN" className="w-full h-full object-contain drop-shadow-xs" />
            </div>

            <div className="min-w-0">
              {/* Judul: PCB {NAMA_CABANG} */}
              {canSwitchBranch ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                    className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white tracking-wide leading-tight truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition text-left"
                    title="Klik untuk ganti cabang"
                  >
                    <span className="truncate">{headerTitle}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-indigo-500 transition-transform flex-shrink-0 ${
                        isBranchDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Ganti Cabang untuk Owner / BM */}
                  {isBranchDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsBranchDropdownOpen(false)}
                      />
                      <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                          {profile.role === 'owner' ? 'Cakupan Cabang (Owner)' : 'Cabang Ditugaskan (BM)'}
                        </div>

                        {profile.role === 'owner' && (
                          <button
                            type="button"
                            onClick={() => {
                              setGlobalView();
                              setIsBranchDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                              isGlobalView
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5" />
                              <span>Semua Cabang (Global)</span>
                            </div>
                            {isGlobalView && <Check className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <div className="space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
                          {availableBranches.map((branch) => {
                            const isSelected = !isGlobalView && currentBranch?.id === branch.id;
                            return (
                              <button
                                key={branch.id}
                                type="button"
                                onClick={() => {
                                  setCurrentBranch(branch);
                                  setIsBranchDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                                  <div className="truncate">
                                    <div className="truncate">{branch.name}</div>
                                    <div
                                      className={`text-[10px] ${
                                        isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      {branch.code} • {branch.city}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-1" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-wide leading-tight truncate">
                  {headerTitle}
                </h1>
              )}

              {/* Tanggal di bawah judul */}
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold text-[11px] mt-0.5">
                <Calendar className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                <span className="capitalize tracking-tight">{todayDateFormatted}</span>
              </div>
            </div>
          </div>

          {/* Right Actions: Theme Switcher & Logout Button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleTheme();
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-amber-400 transition-all cursor-pointer shadow-xs active:scale-90"
              title={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
              aria-label={theme === 'light' ? 'Beralih ke Mode Gelap' : 'Beralih ke Mode Terang'}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-slate-700 hover:text-indigo-600 transition-colors" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-400/30 transition-colors" />
              )}
            </button>

            {/* Tombol Logout di Kanan Icon Switch Tema */}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-9 h-9 sm:w-auto sm:px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-90 cursor-pointer shadow-xs"
              title="Keluar / Logout Akun"
              aria-label="Keluar dari akun"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal Konfirmasi Logout Custom */}
      <ActionPromptModal
        config={
          showLogoutConfirm
            ? {
                type: 'confirm',
                variant: 'danger',
                title: 'Konfirmasi Keluar',
                subtitle: profile ? `${profile.full_name} (@${profile.username})` : undefined,
                message: 'Apakah Anda yakin ingin keluar dari sesi akun ini?',
                confirmLabel: 'Ya, Keluar',
                cancelLabel: 'Batal',
                onConfirm: async () => {
                  setShowLogoutConfirm(false);
                  await logout();
                },
              }
            : null
        }
        onClose={() => setShowLogoutConfirm(false)}
      />
    </>
  );
};
