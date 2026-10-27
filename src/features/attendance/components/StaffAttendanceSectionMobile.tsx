import React, { useState } from 'react';
import type { Attendance, UserRole } from '../../../types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  UserCheck,
  Coins,
  Store as StoreIcon,
  Truck,
} from 'lucide-react';

interface StaffAttendanceSectionMobileProps {
  attendances: Attendance[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const StaffAttendanceSectionMobile: React.FC<StaffAttendanceSectionMobileProps> = ({
  attendances,
  selectedDate,
  onDateChange,
  isLoading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Filtered attendances
  const filtered = attendances.filter((att) => {
    const fullName = att.user?.full_name?.toLowerCase() || '';
    const username = att.user?.username?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(q) || username.includes(q);

    if (!matchesSearch) return false;
    if (roleFilter === 'all') return true;

    if (roleFilter === 'logistik') {
      return att.role === 'logistik' || att.role === 'driver' || att.role === 'kurir';
    }
    if (roleFilter === 'marketing') {
      return att.role === 'marketing' || att.role === 'sales';
    }
    return att.role === roleFilter;
  });


  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' WIB';
    } catch {
      return '-';
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'dropping') {
      return {
        label: 'Dropping',
        icon: Coins,
        className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      };
    }
    if (role === 'marketing' || role === 'sales') {
      return {
        label: 'Marketing',
        icon: StoreIcon,
        className: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
      };
    }
    return {
      label: 'Logistik',
      icon: Truck,
      className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    };
  };

  return (
    <div className="space-y-3.5">
      {/* Header & Date Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Absensi Petugas Lapangan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Pencatatan real-time kehadiran harian
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95 disabled:opacity-50"
            title="Refresh Data Absensi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Date Filter Input */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              onDateChange(todayStr);
            }}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 active:scale-95 transition"
          >
            Hari Ini
          </button>
        </div>
      </div>


      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau username petugas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {(['all', 'dropping', 'marketing', 'logistik'] as const).map((r) => {
            const active = roleFilter === r;
            const labels: Record<string, string> = {
              all: 'Semua Role',
              dropping: 'Dropping',
              marketing: 'Marketing',
              logistik: 'Logistik',
            };
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap border transition active:scale-95 ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Attendance Cards List (Mobile Layout) */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Belum ada absensi tercatat pada tanggal ini.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Absensi petugas akan otomatis muncul di sini setelah mereka menekan tombol "Absen Sekarang".
            </p>
          </div>
        ) : (
          filtered.map((att) => {
            const badge = getRoleBadge(att.role);
            const RoleIcon = badge.icon;
            const staffName = att.user?.full_name || att.user?.username || 'Petugas Lapangan';

            return (
              <div
                key={att.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-2.5 transition"
              >
                {/* Header Card: Nama & Badge Role */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {staffName}
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-lg border flex items-center gap-1 ${badge.className} flex-shrink-0`}
                  >
                    <RoleIcon className="w-3 h-3" />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {/* Info Bar: Waktu Absen & Status */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Absen Masuk:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatTime(att.check_in_time)}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Hadir
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
