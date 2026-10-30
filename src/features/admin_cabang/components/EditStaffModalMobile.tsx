import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserCheck, Phone, User, KeyRound, Cpu } from 'lucide-react';
import { toast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import {
  generateAutoPrefix,
  validateEditStaffForm,
} from '../../../lib/staffLogic';
import type { UserProfile, UserRole } from '../../../types';

interface EditStaffModalMobileProps {
  isOpen: boolean;
  onClose: () => void;
  staff: UserProfile | null;
  onSuccess: (updatedStaff: UserProfile) => void;
}

export const EditStaffModalMobile: React.FC<EditStaffModalMobileProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('dropping');
  const [machinePrefix, setMachinePrefix] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state ketika staff dipilih
  useEffect(() => {
    if (staff) {
      setFullName(staff.full_name || '');
      setUsername(staff.username || '');
      setPhone(staff.phone || '');
      setRole((staff.role as UserRole) || 'dropping');
      setMachinePrefix(staff.machine_prefix || '');
      setPin('');
    }
  }, [staff]);

  if (!isOpen || !staff) return null;

  // Handle Perubahan Role
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'dropping' && !machinePrefix) {
      setMachinePrefix(generateAutoPrefix(fullName));
    }
  };

  // Submit Perubahan Profil Staf
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();
    const cleanPrefix = role === 'dropping' ? (machinePrefix.trim().toUpperCase() || 'MESIN') : null;

    // 1. Validasi Input Form
    const validation = validateEditStaffForm({
      fullName: cleanFullName,
      phone: cleanPhone,
      pin: cleanPin,
      role,
      machinePrefix: cleanPrefix,
    });

    if (!validation.isValid) {
      toast.error(validation.error || 'Mohon periksa kembali isian form.');
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      toast.error('Username minimal 3 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. Cek apakah username dipakai oleh akun lain
      if (cleanUsername !== (staff.username || '').toLowerCase()) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .neq('id', staff.id)
          .maybeSingle();

        if (existingUser) {
          toast.error(`Username "@${cleanUsername}" sudah digunakan oleh akun lain.`);
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Update Profil di Tabel profiles
      const updatePayload: Record<string, any> = {
        full_name: cleanFullName,
        username: cleanUsername,
        phone: cleanPhone,
        role,
        updated_at: new Date().toISOString(),
      };

      if (cleanPin) {
        updatePayload.pin = cleanPin;
      }

      if (role === 'dropping') {
        updatePayload.machine_prefix = cleanPrefix;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', staff.id)
        .select()
        .single();

      if (error) throw error;

      const updatedProfile: UserProfile = {
        ...staff,
        ...updatePayload,
      };

      toast.success(`Profil "${cleanFullName}" (@${cleanUsername}) berhasil diperbarui!`);
      onSuccess(data ? (data as UserProfile) : updatedProfile);
      onClose();
    } catch (err: any) {
      console.error('Error updating staff:', err);
      toast.error(err.message || 'Gagal menyimpan perubahan data karyawan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Edit Karyawan Cabang
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Perbarui profil & akses login operasional
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 overflow-y-auto scrollbar-none text-xs">
          {/* 1. Nama Lengkap */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap <span className="text-rose-500 font-bold ml-0.5">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="Misal: Andi Saputra"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
            </div>
          </div>

          {/* 2. Nomor WhatsApp / Telepon */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nomor WhatsApp / HP <span className="text-rose-500 font-bold ml-0.5">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="tel"
                required
                placeholder="081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
            </div>
          </div>

          {/* 3. Peran / Tugas Operasional */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Peran Operasional <span className="text-rose-500 font-bold ml-0.5">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
            >
              <option value="dropping">Dropping</option>
              <option value="marketing">Marketing</option>
              <option value="logistik">Logistik</option>
              {(staff.role === 'admin_cabang' || staff.role === 'admin') && (
                <option value="admin_cabang">Admin Cabang</option>
              )}
              {staff.role === 'branch_manager' && (
                <option value="branch_manager">Branch Manager</option>
              )}
            </select>
          </div>

          {/* 4. Khusus Role Dropping: Prefix Kode Mesin */}
          {role === 'dropping' && (
            <div className="space-y-1 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  Kode Mesin <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Contoh: {machinePrefix || 'MSN'}-01
                </span>
              </div>
              <input
                type="text"
                required
                placeholder="NAMA"
                value={machinePrefix}
                onChange={(e) => {
                  setMachinePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                }}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white uppercase outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                kode mesin untuk petugas dropping.
              </p>
            </div>
          )}

          {/* 5. Username Login */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Username Login <span className="text-rose-500 font-bold ml-0.5">*</span>
              </label>
            </div>
            <div className="relative">
              <span className="text-slate-400 font-bold absolute left-3.5 top-2.5 text-xs pointer-events-none">
                @
              </span>
              <input
                type="text"
                required
                placeholder="andi"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                }}
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Digunakan saat login aplikasi.
            </p>
          </div>

          {/* 6. PIN Keamanan 6-Digit */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              PIN Login (6-Digit)
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none z-10" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors placeholder:text-slate-400 placeholder:text-xs placeholder:font-sans placeholder:tracking-[0.3em]"
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Kosongkan jika tidak ingin mengubah PIN saat ini.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
