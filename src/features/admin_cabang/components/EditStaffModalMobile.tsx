import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserCheck, Phone, User, KeyRound, Cpu } from 'lucide-react';
import { toast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import { validateEditStaffForm } from '../../../lib/staffLogic';
import type { UserProfile } from '../../../types';

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
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [machinePrefix, setMachinePrefix] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state ketika staff dipilih
  useEffect(() => {
    if (staff) {
      setFullName(staff.full_name || '');
      setPhone(staff.phone || '');
      setPin('');
      setMachinePrefix(staff.machine_prefix || '');
    }
  }, [staff]);

  if (!isOpen || !staff) return null;

  const isDropping = staff.role === 'dropping' || staff.assigned_task === 'dropping';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();
    const cleanPrefix = isDropping ? (machinePrefix.trim().toUpperCase() || 'MESIN') : null;

    // 1. Validasi
    const validation = validateEditStaffForm({
      fullName: cleanFullName,
      phone: cleanPhone,
      pin: cleanPin,
      role: staff.role,
      machinePrefix: cleanPrefix,
    });

    if (!validation.isValid) {
      toast.error(validation.error || 'Mohon periksa kembali isian form.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatePayload: {
        full_name: string;
        phone: string;
        pin?: string;
        machine_prefix?: string | null;
        updated_at: string;
      } = {
        full_name: cleanFullName,
        phone: cleanPhone,
        updated_at: new Date().toISOString(),
      };

      if (cleanPin) {
        updatePayload.pin = cleanPin;
      }

      if (isDropping && cleanPrefix) {
        updatePayload.machine_prefix = cleanPrefix;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', staff.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const updated: UserProfile = {
        ...staff,
        full_name: cleanFullName,
        phone: cleanPhone,
        ...(cleanPin ? { pin: cleanPin } : {}),
        ...(isDropping && cleanPrefix ? { machine_prefix: cleanPrefix } : {}),
      };

      toast.success(`Profil "${cleanFullName}" berhasil diperbarui.`);
      onSuccess(data ? (data as UserProfile) : updated);
      onClose();
    } catch (err: any) {
      console.error('Gagal memperbarui staf:', err);
      toast.error(err.message || 'Gagal menyimpan perubahan profil petugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Edit Data Petugas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{staff.username} • {staff.role}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* 1. Nama Lengkap */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Lengkap <span className="text-rose-600 font-extrabold">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama lengkap petugas..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 2. Nomor WhatsApp */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nomor WhatsApp / HP <span className="text-rose-600 font-extrabold">*</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                placeholder="0812xxxxxxxx"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nomor aktif untuk koordinasi cabang dan notifikasi sistem.
            </p>
          </div>

          {/* 3. Prefix Kode Mesin (Khusus Staf Dropping) */}
          {isDropping && (
            <div className="space-y-1 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Prefix Kode Mesin Dropping</span>
                </label>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  Format: {machinePrefix || 'KODE'}-01
                </span>
              </div>
              <input
                type="text"
                maxLength={10}
                value={machinePrefix}
                onChange={(e) => setMachinePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Contoh: NAUFAL, ANDI"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-black text-xs tracking-wider uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Identitas kode mesin yang dipegang petugas ini di lapangan.
              </p>
            </div>
          )}

          {/* 4. PIN Baru (Opsional ganti) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Ganti PIN Login (Opsional)
            </label>
            <div className="relative flex items-center">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full pl-9 pr-3.5 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-sans tracking-widest placeholder:text-slate-400 placeholder:font-sans placeholder:tracking-widest placeholder:leading-none focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Biarkan kosong jika tidak ingin mengubah PIN saat ini.
            </p>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
