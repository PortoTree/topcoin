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
  ClipboardCheck,
  Layers,
  Route,
  Clock,
  CalendarOff,
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
        // 5 Navigasi Utama: omset | petugas | laporan | rute | absen
        return [
          { id: 'omset', label: 'Omset', icon: TrendingUp },
          { id: 'schedule', label: 'Petugas', icon: Users },
          { id: 'reports', label: 'Laporan', icon: ClipboardCheck },
          { id: 'route', label: 'Rute', icon: Route },
          { id: 'attendance', label: 'Absen', icon: Clock },
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
          { id: 'daily_summary', label: 'Riwayat', icon: ClipboardList },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  // 5 Navigasi Tambahan: libur | logistik | tugas | toko | mesin
  const assignedTask = profile.assigned_task;
  const taskIcon =
    assignedTask === 'logistik' || assignedTask === 'driver'
      ? Truck
      : assignedTask === 'marketing'
        ? StoreIcon
        : ClipboardList;

  const adminExpandedMenus = [
    { id: 'leave', label: 'Libur', icon: CalendarOff },
    { id: 'driver_dispatch', label: 'Logistik', icon: Truck },
    { id: 'admin_task', label: 'Tugas', icon: taskIcon },
    { id: 'stores', label: 'Toko', icon: StoreIcon },
    { id: 'machines', label: 'Mesin', icon: Cpu },
  ];

  return (
    <>
      {/* Backdrop saat Drawer Ter-expand dengan Transisi Halus Fade */}
      {isAdmin && (
        <div
          className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-xs transition-opacity duration-200 ease-out ${isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Container Navigasi Utama (Border radius khusus untuk Admin / Branch Manager) */}
      <nav
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] max-w-[480px] mx-auto transition-all duration-200 ease-out ${hasRoundedNav
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

        {/* Drawer Menu Tambahan dengan Tampilan Icon + Label di Bawahnya (Persis Mirip Navigasi Bar) */}
        {isAdmin && (
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded
                ? 'max-h-[140px] opacity-100 border-b border-slate-200 dark:border-slate-800 mb-1'
                : 'max-h-0 opacity-0 pointer-events-none border-b-0 mb-0'
              }`}
          >
            <div className="px-1 pt-0.5 pb-2">
              <div className="flex items-center justify-center gap-1.5 py-1 mb-1">
                <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  MENU TAMBAHAN
                </span>
              </div>

              {/* Baris 5 Icon Menu Tambahan (Persis Mirip Navigasi Bar) */}
              <div className="flex items-center justify-around px-1 py-0.5">
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
                      className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer ${isCurrentActive
                          ? 'text-indigo-700 dark:text-indigo-400 font-extrabold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                        }`}
                    >
                      <div
                        className={`p-1 rounded-lg transition-colors ${isCurrentActive
                            ? 'bg-indigo-100 dark:bg-indigo-500/15'
                            : 'bg-transparent'
                          }`}
                      >
                        <Icon className={`w-5 h-5 ${isCurrentActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                      </div>
                      <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[68px] text-center">
                        {menu.label}
                      </span>
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
                className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer ${isActive
                    ? 'text-indigo-700 dark:text-indigo-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                  }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-indigo-100 dark:bg-indigo-500/15' : 'bg-transparent'
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
