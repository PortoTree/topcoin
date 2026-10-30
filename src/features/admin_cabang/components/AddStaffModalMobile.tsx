import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Phone, User, KeyRound, Cpu } from 'lucide-react';
import { toast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabase';
import {
  generateAutoUsername,
  generateAutoPrefix,
  validateNewStaffForm,
} from '../../../lib/staffLogic';
import type { UserProfile, UserRole } from '../../../types';

interface AddStaffModalMobileProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  onSuccess: (newStaff: UserProfile) => void;
}

export const AddStaffModalMobile: React.FC<AddStaffModalMobileProps> = ({
  isOpen,
  onClose,
  branchId,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameEdited, setIsUsernameEdited] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'dropping' | 'marketing' | 'logistik'>('dropping');
  const [machinePrefix, setMachinePrefix] = useState('');
  const [isPrefixEdited, setIsPrefixEdited] = useState(false);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Handle Perubahan Nama Lengkap (Auto-generate Username & Prefix)
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullName(val);

    // Jika username belum pernah diedit manual, otomatis generate dari nama depan
    if (!isUsernameEdited) {
      setUsername(generateAutoUsername(val));
    }

    // Jika role dropping dan prefix belum diedit manual, otomatis generate
    if (!isPrefixEdited) {
      setMachinePrefix(generateAutoPrefix(val));
    }
  };

  // Handle Perubahan Role
  const handleRoleChange = (newRole: 'dropping' | 'marketing' | 'logistik') => {
    setRole(newRole);
    if (newRole === 'dropping' && !machinePrefix) {
      setMachinePrefix(generateAutoPrefix(fullName));
    }
  };

  // Submit Pendaftaran Karyawan Baru
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPin = pin.trim() || '123456';
    const cleanPrefix = role === 'dropping' ? (machinePrefix.trim().toUpperCase() || 'MESIN') : null;

    // 1. Validasi Input Form
    const validation = validateNewStaffForm({
      fullName: cleanFullName,
      username: cleanUsername,
      phone: cleanPhone,
      pin: cleanPin,
      role,
      machinePrefix: cleanPrefix,
    });

    if (!validation.isValid) {
      toast.error(validation.error || 'Mohon lengkapi data karyawan.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. Cek apakah username sudah dipakai di database
      const { data: existingUser, error: checkErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (checkErr) {
        console.warn('Check username error:', checkErr);
      }

      if (existingUser) {
        toast.error(`Username "@${cleanUsername}" sudah digunakan. Silakan gunakan username lain.`);
        setIsSubmitting(false);
        return;
      }

      // 3. Registrasi Supabase Auth User via REST API
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tuhhydrwustfvrcgvodt.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const generatedEmail = `${cleanUsername}_${Date.now().toString().slice(-4)}@internal.app`;
      const dummyPassword = `${cleanPin}Pass#123!_`;

      const authRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: generatedEmail,
          password: dummyPassword,
        }),
      });

      const authData = await authRes.json();
      const authUserId = authData.id || authData.user?.id;

      if (!authUserId) {
        throw new Error(authData.message || authData.error_description || 'Gagal membuat identitas login Supabase.');
      }

      // 4. Simpan Profil Karyawan ke Tabel profiles
      const profilePayload: Partial<UserProfile> = {
        id: authUserId,
        username: cleanUsername,
        full_name: cleanFullName,
        phone: cleanPhone,
        email: generatedEmail,
        role: role as UserRole,
        branch_id: branchId,
        pin: cleanPin,
        machine_prefix: cleanPrefix,
        is_active: true,
        deletion_status: 'active',
        auth_provider: 'pin',
      };

      const { data: insertedProfiles, error: profileErr } = await supabase
        .from('profiles')
        .insert(profilePayload)
        .select()
        .single();

      if (profileErr) throw profileErr;

      toast.success(`Karyawan "${cleanFullName}" (@${cleanUsername}) berhasil didaftarkan!`);
      onSuccess(insertedProfiles as UserProfile);
      onClose();
    } catch (err: any) {
      console.error('Error adding staff:', err);
      toast.error(err.message || 'Gagal mendaftarkan karyawan.');
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
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Tambah Karyawan Cabang
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Lengkapi profil & akses login operasional
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
                onChange={handleFullNameChange}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
            </div>
          </div>

          {/* 3. Nomor WhatsApp / Telepon */}
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

          {/* 4. Peran / Tugas Operasional */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Peran Operasional <span className="text-rose-500 font-bold ml-0.5">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
            >
              <option value="dropping">Dropping</option>
              <option value="marketing">Marketing</option>
              <option value="logistik">Logistik</option>
            </select>
          </div>

          {/* 5. Khusus Role Dropping: Prefix Kode Mesin */}
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
                  setIsPrefixEdited(true);
                }}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white uppercase outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                kode mesin untuk petugas dropping.
              </p>
            </div>
          )}

          {/* 2. Username Login (Auto-Generated dari Nama Depan tapi Bisa Diedit) */}
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
                  setIsUsernameEdited(true);
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
              PIN Login (6-Digit) <span className="text-rose-500 font-bold ml-0.5">*</span>
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
              Default: 123456 (karyawan dapat mengganti PIN di profil masing-masing).
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
              {isSubmitting ? 'Mendaftarkan...' : 'Simpan Karyawan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

