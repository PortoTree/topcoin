import React from 'react';
import { useAuth } from '../context/AuthContext';
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
} from 'lucide-react';

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { profile, activeRole } = useAuth();

  if (!profile) return null;

  const getNavItems = () => {
    const currentRole = activeRole || profile.role;
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
          { id: 'approvals', label: 'Approval Hapus', icon: ShieldCheck },
          { id: 'branch_staff', label: 'Karyawan', icon: Users },
        ];
      case 'admin_cabang':
      case 'admin': {
        const assignedTask = profile.assigned_task;
        const taskItems = [];
        if (assignedTask && assignedTask !== 'admin_cabang') {
          const taskIcon =
            assignedTask === 'logistik' || assignedTask === 'driver'
              ? Truck
              : assignedTask === 'marketing'
              ? StoreIcon
              : ClipboardList;
          taskItems.push({ id: 'admin_task', label: 'Tugas', icon: taskIcon });
        }

        return [
          ...taskItems,
          { id: 'monitoring', label: 'Live Omset', icon: TrendingUp },
          { id: 'driver_dispatch', label: 'Tugas Logistik', icon: Truck },
          { id: 'machines', label: 'Mesin & Toko', icon: Cpu },
          { id: 'employees', label: 'Karyawan', icon: Users },
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
          { id: 'store_visits', label: 'Kunjungan Toko', icon: StoreIcon },
          { id: 'daily_summary', label: 'Rekap Hari Ini', icon: ClipboardList },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] max-w-[480px] mx-auto transition-colors duration-200">
      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-indigo-700 dark:text-indigo-400 font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-100 dark:bg-indigo-500/15'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[70px] text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
