import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMobileBackHandler } from '../hooks/useMobileBackHandler';
import {
  TrendingUp,
  Store as StoreIcon,
  Truck,
  ClipboardList,
  CheckCircle2,
  Building2,
  Users,
  ShieldCheck,
  Cpu,
  FileSpreadsheet,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  Coins,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { profile, activeRole } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // Native back handler closes expanded drawer if open
  useMobileBackHandler({
    enabled: isExpanded,
    onBack: () => setIsExpanded(false),
  });

  if (!profile) return null;

  const currentRole = activeRole || profile.role;
  const isAdmin = currentRole === 'admin_cabang' || currentRole === 'admin';
  const isBranchManager = currentRole === 'branch_manager';
  const hasRoundedNav = isAdmin || isBranchManager;

  // Handle Drag / Swipe Gestures on Bottom Nav
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isAdmin) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAdmin || touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Swipe up to expand (threshold: -35px)
    if (deltaY < -35 && !isExpanded) {
      setIsExpanded(true);
      touchStartY.current = null;
    }
    // Swipe down to collapse (threshold: +35px)
    else if (deltaY > 35 && isExpanded) {
      setIsExpanded(false);
      touchStartY.current = null;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = null;
  };

  const getNavItems = () => {
    switch (currentRole) {
      case 'owner':
        return [
          { id: 'global_recap', label: 'Konsolidasi', icon: TrendingUp },
          { id: 'branches', label: 'Cabang', icon: Building2 },
          { id: 'users', label: 'Karyawan', icon: Users },
          { id: 'backup_audit', label: 'Audit JSON', icon: FileSpreadsheet },
        ];
      case 'branch_manager':
        return [
          { id: 'bm_overview', label: 'Supervisi', icon: TrendingUp },
          { id: 'driver_dispatch', label: 'Tugas Logistik', icon: Truck },
          { id: 'approvals', label: 'Approval Hapus', icon: ShieldCheck },
          { id: 'branch_staff', label: 'Karyawan', icon: Users },
        ];
      case 'admin_cabang':
      case 'admin': {
        const assignedTask = profile.assigned_task;
        const taskIcon =
          assignedTask === 'logistik' || assignedTask === 'driver'
            ? Truck
            : assignedTask === 'marketing'
              ? StoreIcon
              : ClipboardList;

        // 5 Navigasi Default Utama Sesuai Instruksi User:
        // 1. Tugas (dynamic tugas admin)
        // 2. Omset (placeholder)
        // 3. Jadwal (karyawan/staff)
        // 4. Mesin (placeholder)
        // 5. Laporan (absensi harian)
        return [
          { id: 'admin_task', label: 'Tugas', icon: taskIcon },
          { id: 'omset', label: 'Omset', icon: TrendingUp },
          { id: 'schedule', label: 'Jadwal', icon: CalendarDays },
          { id: 'machines', label: 'Mesin', icon: Cpu },
          { id: 'reports', label: 'Laporan', icon: ClipboardCheck },
        ];
      }
      case 'marketing':
      case 'sales':
        return [
          { id: 'new_store', label: 'Input Toko', icon: StoreIcon },
          { id: 'my_stores', label: 'Daftar Toko', icon: ClipboardList },
        ];
      case 'logistik':
      case 'driver':
      case 'kurir':
        return [
          { id: 'driver_tasks', label: 'Tugas Logistik', icon: Truck },
          { id: 'completed_tasks', label: 'Selesai', icon: CheckCircle2 },
        ];
      case 'dropping':
        return [
          { id: 'store_visits', label: 'Tugas', icon: StoreIcon },
          { id: 'daily_summary', label: 'Riwayat hari ini', icon: ClipboardList },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  // Menu Tambahan Admin dalam Drawer Expand
  const adminExpandedMenus = [
    {
      id: 'reconciliation',
      title: 'Rekonsiliasi Kas',
      subtitle: 'Tutup kas & hitung uang fisik setoran dropping',
      icon: DollarSign,
      color: 'emerald',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'driver_dispatch',
      title: 'Tugas Logistik Dispatch',
      subtitle: 'Penugasan distribusi & relokasi unit mesin armada',
      icon: Truck,
      color: 'amber',
      bgClass: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'monitoring',
      title: 'Monitoring Transaksi',
      subtitle: 'Pantau koin dan omset dropping live hari ini',
      icon: Coins,
      color: 'blue',
      bgClass: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    },
  ];

  return (
    <>
      {/* Backdrop saat Drawer Ter-expand dengan Transisi Halus Fade */}
      {isAdmin && (
        <div
          className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity duration-200 ease-out ${
            isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Container Navigasi Utama (Border radius khusus untuk Admin / Branch Manager) */}
      <nav
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] max-w-[480px] mx-auto transition-all duration-200 ease-out ${
          hasRoundedNav
            ? 'rounded-t-3xl border-t border-x border-slate-200 dark:border-slate-800 shadow-2xl'
            : 'rounded-none border-t border-slate-200 dark:border-slate-800 shadow-lg'
        }`}
      >
        {/* Drag Pill Handle Minimalis (Khusus Akun Admin - Tanpa Teks) */}
        {isAdmin && (
          <div
            onClick={() => setIsExpanded((prev) => !prev)}
            className="w-full pt-3 pb-2 flex items-center justify-center cursor-pointer select-none active:opacity-60 group"
            title="Geser atau klik untuk buka/tutup menu tambahan"
          >
            {/* Visual Drag Bar */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500 rounded-full transition-colors" />
          </div>
        )}

        {/* Drawer Menu Tambahan dengan Animasi Slide Up & Down yang Snappy & Smooth */}
        {isAdmin && (
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${
              isExpanded
                ? 'max-h-[380px] opacity-100 border-b border-slate-200 dark:border-slate-800 mb-2'
                : 'max-h-0 opacity-0 pointer-events-none border-b-0 mb-0'
            }`}
          >
            <div className="px-4 pt-1 pb-3 space-y-2">
              <div className="flex items-center gap-1.5 py-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  MENU TAMBAHAN
                </span>
              </div>

                {/* List Kartu Menu Tambahan */}
                <div className="space-y-1.5">
                  {adminExpandedMenus.map((menu) => {
                    const Icon = menu.icon;
                    const isCurrentActive = activeTab === menu.id;

                    return (
                      <button
                        key={menu.id}
                        type="button"
                        onClick={() => {
                          onTabChange(menu.id);
                          setIsExpanded(false);
                        }}
                        className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer ${
                          isCurrentActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${menu.bgClass}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 dark:text-white block">
                              {menu.title}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                              {menu.subtitle}
                            </span>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        {/* Baris 5 Navigasi Default Utama */}
        <div className="flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'schedule' && activeTab === 'employees');

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (isExpanded) setIsExpanded(false);
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer ${
                  isActive
                    ? 'text-indigo-700 dark:text-indigo-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-100 dark:bg-indigo-500/15' : 'bg-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[68px] text-center">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
