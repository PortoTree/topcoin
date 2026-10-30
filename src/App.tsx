import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth, isManagementRole } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { LoginView } from './features/auth/LoginView';
import { AttendanceHomeView } from './features/attendance/AttendanceHomeView';
import { MobileHeader } from './components/MobileHeader';
import { BottomNavBar } from './components/BottomNavBar';
import { ActionPromptModal } from './components/ActionPromptModal';
import { OwnerView } from './features/owner/OwnerView';
import { BranchManagerView } from './features/branch_manager/BranchManagerView';
import { AdminCabangView } from './features/admin_cabang/AdminCabangView';
import { MarketingView } from './features/marketing/MarketingView';
import { DriverView } from './features/driver/DriverView';
import { DroppingView } from './features/dropping/DroppingView';
import { useRootBackGuard } from './hooks/useMobileBackHandler';

const MainAppContent: React.FC = () => {
  const { profile, role, activeRole, isLoading, logout } = useAuth();
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  useRootBackGuard(
    useCallback(() => {
      setShowExitConfirmModal(true);
    }, [])
  );

  const [activeTab, setActiveTab] = useState<string>('');
  const [tabClickTick, setTabClickTick] = useState<number>(0);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setTabClickTick((prev) => prev + 1);
  };

  // Set default tab according to active role:
  // For field workers, prioritize quick operational/camera action!
  useEffect(() => {
    const current = activeRole || role;
    if (current === 'owner') setActiveTab('global_recap');
    else if (current === 'branch_manager') setActiveTab('bm_overview');
    else if (current === 'admin_cabang' || current === 'admin') {
      if (profile?.assigned_task && profile.assigned_task !== 'admin_cabang') {
        setActiveTab('admin_task');
      } else {
        setActiveTab('schedule');
      }
    }
    else if (current === 'marketing' || current === 'sales') setActiveTab('new_store');
    else if (current === 'logistik' || current === 'driver' || current === 'kurir') setActiveTab('driver_tasks');
    else if (current === 'dropping') setActiveTab('store_visits'); // List kunjungan toko partner
  }, [activeRole, role, profile?.assigned_task]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center p-2">
          <img src="/topcoin.png" alt="PCB TOP COIN" className="w-full h-full object-contain" />
        </div>
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">Memuat PCB TOP COIN Multi-Cabang...</p>
      </div>
    );
  }

  // 1. Not logged in -> Show Login View (Username + PIN)
  // 2. Field worker who has NOT checked in today -> Show Attendance Home View
  // 3. User is ready (Management or Field worker who has checked in) -> Show Operational Dashboard
  const currentOperatingRole = activeRole || role;

  return (
    <>
      {!profile ? (
        <div className="mobile-container bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
          <LoginView />
        </div>
      ) : !isManagementRole(role) && !activeRole ? (
        <div className="mobile-container relative bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
          <AttendanceHomeView />
        </div>
      ) : (
        <div className="mobile-container relative bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
          {/* Mobile Top Header */}
          <MobileHeader />

          {/* Main Content View by Active Role */}
          <main className="w-full">
            {currentOperatingRole === 'owner' && <OwnerView activeTab={activeTab} />}
            {currentOperatingRole === 'branch_manager' && <BranchManagerView activeTab={activeTab} />}
            {(currentOperatingRole === 'admin_cabang' || currentOperatingRole === 'admin') && (
              <AdminCabangView activeTab={activeTab} />
            )}
            {(currentOperatingRole === 'marketing' || currentOperatingRole === 'sales') && (
              <MarketingView activeTab={activeTab} />
            )}
            {(currentOperatingRole === 'logistik' || currentOperatingRole === 'driver' || currentOperatingRole === 'kurir') && (
              <DriverView activeTab={activeTab} />
            )}
            {currentOperatingRole === 'dropping' && (
              <DroppingView activeTab={activeTab} tabClickTick={tabClickTick} />
            )}
          </main>

          {/* Mobile Ergonomic Bottom Navigation */}
          <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      )}

      {/* Modal Konfirmasi Keluar saat tombol Back ditekan di halaman utama / root */}
      <ActionPromptModal
        config={
          showExitConfirmModal
            ? {
                type: 'confirm',
                variant: 'danger',
                title: 'Keluar dari Aplikasi?',
                subtitle: 'Konfirmasi Keluar',
                message: profile
                  ? 'Apakah Anda yakin ingin keluar dari sesi aplikasi TOP COIN?'
                  : 'Apakah Anda ingin keluar dari aplikasi TOP COIN?',
                confirmLabel: 'Ya, Keluar',
                cancelLabel: 'Batal',
                onConfirm: async () => {
                  setShowExitConfirmModal(false);
                  if (profile) {
                    await logout();
                  }
                },
                onCancel: () => setShowExitConfirmModal(false),
              }
            : null
        }
        onClose={() => setShowExitConfirmModal(false)}
      />
    </>
  );
};

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BranchProvider>
          <ToastProvider>
            <MainAppContent />
          </ToastProvider>
        </BranchProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
