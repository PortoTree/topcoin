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
  MessageSquare,
  Users,
} from 'lucide-react';

interface StaffAttendanceSectionDesktopProps {
  attendances: Attendance[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const StaffAttendanceSectionDesktop: React.FC<StaffAttendanceSectionDesktopProps> = ({
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

  // Summary counts
  const countDropping = attendances.filter((a) => a.role === 'dropping').length;
  const countMarketing = attendances.filter((a) => a.role === 'marketing' || a.role === 'sales').length;
  const countLogistik = attendances.filter((a) => a.role === 'logistik' || a.role === 'driver' || a.role === 'kurir').length;

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
    <div className="space-y-4">
      {/* Top Banner & Date Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Log Absensi Harian Petugas Lapangan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Data pencatatan kehadiran resmi staf dropping, marketing, dan logistik per tanggal kerja
            </p>
          </div>
        </div>

        {/* Date Filter & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              onDateChange(todayStr);
            }}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-extrabold text-indigo-600 dark:text-indigo-400 active:scale-95 transition"
          >
            Hari Ini
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95 disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Desktop Metrics Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Hadir
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
              {attendances.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Dropping
            </span>
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
              {countDropping}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Marketing
            </span>
            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1 block">
              {countMarketing}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <StoreIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Logistik
            </span>
            <span className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1 block">
              {countLogistik}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3">
        {/* Role Pills */}
        <div className="flex items-center gap-2">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau username staf..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-12 text-center">No</th>
              <th className="py-3 px-4">Nama Petugas</th>
              <th className="py-3 px-4">Tugas / Role</th>
              <th className="py-3 px-4">Tanggal Kerja</th>
              <th className="py-3 px-4">Waktu Absen Masuk</th>
              <th className="py-3 px-4">Kontak</th>
              <th className="py-3 px-4 text-center">Status Kehadiran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">
                  <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="font-bold">Belum ada absensi tercatat pada tanggal ini.</p>
                  <p className="text-[11px]">Staf lapangan yang menekan "Absen Sekarang" akan otomatis tercatat di sini.</p>
                </td>
              </tr>
            ) : (
              filtered.map((att, idx) => {
                const badge = getRoleBadge(att.role);
                const RoleIcon = badge.icon;
                const staffName = att.user?.full_name || att.user?.username || 'Petugas Lapangan';
                const username = att.user?.username ? `@${att.user.username}` : '';
                const phone = att.user?.phone;

                return (
                  <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{staffName}</div>
                      {username && <div className="text-[10px] text-slate-400 font-mono">{username}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border ${badge.className}`}
                      >
                        <RoleIcon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-600 dark:text-slate-300">
                      {att.work_date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        <span>{formatTime(att.check_in_time)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {phone ? (
                        <a
                          href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Hadir
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
