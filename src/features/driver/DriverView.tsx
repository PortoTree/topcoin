import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { CameraCapture } from '../../components/CameraCapture';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Truck,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Coins,
  ArrowRight,
  ExternalLink,
  Wrench,
  PackagePlus,
  X,
  Sparkles,
  FileText,
  Pencil,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { DriverTask, DriverTaskType } from '../../types';
import { toast } from '../../context/ToastContext';

interface DriverViewProps {
  activeTab: string;
}

// Demo fallback tasks for instant testing
const DEMO_DRIVER_TASKS: DriverTask[] = [
  {
    id: 'task-demo-1',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    task_type: 'relokasi_mesin',
    driver_id: '66666666-6666-6666-6666-666666666666',
    assigned_by: '33333333-3333-3333-3333-333333333333',
    status: 'assigned',
    notes: 'Relokasi unit MSN-SBY-001 dari Toko Berkah Mandiri ke Kedai Kopi Rezeki.',
    created_at: new Date().toISOString(),
    store: {
      id: 'store-demo-1',
      name: 'Toko Berkah Mandiri',
      address: 'Jl. Basuki Rahmat No. 12, Surabaya',
      owner_name: 'Pak Haji Ahmad',
      phone: '081234567890',
      latitude: -7.265,
      longitude: 112.742,
      status: 'terpasang',
      current_machine_id: 'm-demo-1',
      photo_store_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    target_store: {
      id: 'store-demo-2',
      name: 'Kedai Kopi Rezeki',
      address: 'Jl. Embong Malang No. 45, Surabaya',
      owner_name: 'Ibu Ratna',
      phone: '081298765432',
      latitude: -7.261,
      longitude: 112.738,
      status: 'terpasang',
      current_machine_id: null,
      photo_store_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    machine: {
      id: 'm-demo-1',
      machine_code: 'MSN-SBY-001',
      status: 'terpasang',
      current_store_id: 'store-demo-1',
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'task-demo-2',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    task_type: 'opsional',
    driver_id: '66666666-6666-6666-6666-666666666666',
    assigned_by: '33333333-3333-3333-3333-333333333333',
    status: 'assigned',
    notes: 'Cek kondisi fisik mesin dan instalasi spanduk di Warung Barokah.',
    created_at: new Date().toISOString(),
    store: {
      id: 'store-demo-3',
      name: 'Warung Barokah',
      address: 'Jl. Pemuda No. 18, Surabaya',
      owner_name: 'Pak Doni',
      phone: '081345678912',
      latitude: -7.267,
      longitude: 112.748,
      status: 'terpasang',
      current_machine_id: 'm-demo-3',
      photo_store_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    machine: {
      id: 'm-demo-3',
      machine_code: 'MSN-SBY-003',
      status: 'terpasang',
      current_store_id: 'store-demo-3',
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
];

export const DriverView: React.FC<DriverViewProps> = ({ activeTab }) => {
  const { profile } = useAuth();
  const { currentBranch } = useBranch();

  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<DriverTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Execution Modal State
  const [activeTaskToExecute, setActiveTaskToExecute] = useState<DriverTask | null>(null);
  const [evidencePhotoBlob, setEvidencePhotoBlob] = useState<Blob | string | null>(null);
  const [executionNotes, setExecutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Instruction & Notes Modal State
  const [selectedInstruction, setSelectedInstruction] = useState<{ storeName: string; notes: string } | null>(null);
  const [editingTaskNotes, setEditingTaskNotes] = useState<DriverTask | null>(null);
  const [taskNoteInput, setTaskNoteInput] = useState('');

  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const fetchTasks = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .select(`
          *,
          store:stores(*),
          target_store:stores!target_store_id(*),
          machine:machines(*)
        `)
        .eq('branch_id', activeBranchId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const allTasks = data as DriverTask[];
        setTasks(allTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'));
        setCompletedTasks(allTasks.filter((t) => t.status === 'completed'));
      } else {
        // Fallback demo tasks
        setTasks(DEMO_DRIVER_TASKS.filter((t) => t.status !== 'completed'));
        setCompletedTasks([]);
      }
    } catch (err) {
      console.error('Error fetching driver tasks:', err);
      setTasks(DEMO_DRIVER_TASKS.filter((t) => t.status !== 'completed'));
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, activeBranchId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Complete Task Submission
  const handleCompleteTask = async () => {
    if (!activeTaskToExecute) return;

    if (!evidencePhotoBlob) {
      toast.warning('Wajib jepret foto bukti penyelesaian tugas langsung dari kamera!');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload foto bukti
      const photoUrl = await uploadToCloudinary(evidencePhotoBlob, 'driver_tasks');

      // 2. Update task record in DB
      const { error: taskErr } = await supabase
        .from('driver_tasks')
        .update({
          status: 'completed',
          photo_evidence_url: photoUrl,
          notes: executionNotes.trim() ? `${activeTaskToExecute.notes || ''} [Logistik: ${executionNotes.trim()}]` : activeTaskToExecute.notes,
          completed_at: new Date().toISOString(),
        })
        .eq('id', activeTaskToExecute.id);

      if (taskErr) {
        console.warn('DB update fallback:', taskErr);
      }

      // 3. Auto-update Store and Machine status based on task type
      if (activeTaskToExecute.task_type === 'pasang_baru') {
        if (activeTaskToExecute.store_id) {
          await supabase.from('stores').update({ status: 'terpasang', current_machine_id: activeTaskToExecute.machine_id }).eq('id', activeTaskToExecute.store_id);
        }
        if (activeTaskToExecute.machine_id) {
          await supabase.from('machines').update({ status: 'terpasang', current_store_id: activeTaskToExecute.store_id }).eq('id', activeTaskToExecute.machine_id);
        }
      } else if (activeTaskToExecute.task_type === 'tarik_rusak') {
        if (activeTaskToExecute.machine_id) {
          await supabase.from('machines').update({ status: 'maintenance', current_store_id: null }).eq('id', activeTaskToExecute.machine_id);
        }
        if (activeTaskToExecute.store_id) {
          await supabase.from('stores').update({ current_machine_id: null }).eq('id', activeTaskToExecute.store_id);
        }
      } else if (activeTaskToExecute.task_type === 'relokasi_mesin') {
        if (activeTaskToExecute.target_store_id && activeTaskToExecute.machine_id) {
          await supabase.from('machines').update({ current_store_id: activeTaskToExecute.target_store_id }).eq('id', activeTaskToExecute.machine_id);
          await supabase.from('stores').update({ current_machine_id: activeTaskToExecute.machine_id, status: 'terpasang' }).eq('id', activeTaskToExecute.target_store_id);
        }
      }

      // Confetti feedback
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {
        // ignore
      }

      // Move locally
      const updatedTask: DriverTask = {
        ...activeTaskToExecute,
        status: 'completed',
        photo_evidence_url: photoUrl,
        completed_at: new Date().toISOString(),
      };

      setTasks((prev) => prev.filter((t) => t.id !== activeTaskToExecute.id));
      setCompletedTasks((prev) => [updatedTask, ...prev]);

      // Reset modal
      setActiveTaskToExecute(null);
      setEvidencePhotoBlob(null);
      setExecutionNotes('');
      toast.success('Tugas berhasil diselesaikan & terverifikasi!');
    } catch (err: any) {
      console.error('Error completing task:', err);
      toast.error(err.message || 'Gagal menyelesaikan tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark task as In Transit ("Diangkut")
  const handleMarkAsInTransit = async (task: DriverTask) => {
    try {
      const { error } = await supabase
        .from('driver_tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id);

      if (error) console.warn('DB in_progress fallback:', error);

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'in_progress' } : t))
      );

      toast.success(
        task.task_type === 'relokasi_mesin'
          ? 'Mesin telah diangkut! Rute pengantaran diarahkan ke Toko Tujuan.'
          : 'Status tugas diperbarui menjadi sedang berjalan.'
      );
    } catch (err: any) {
      toast.error('Gagal memperbarui status tugas.');
    }
  };

  // Save Task Note from Pencil Icon
  const handleSaveTaskNote = async () => {
    if (!editingTaskNotes) return;
    try {
      const { error } = await supabase
        .from('driver_tasks')
        .update({ notes: taskNoteInput.trim() || null })
        .eq('id', editingTaskNotes.id);

      if (error) console.warn('DB update task note fallback:', error);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskNotes.id ? { ...t, notes: taskNoteInput.trim() || null } : t
        )
      );
      toast.success('Catatan berhasil disimpan.');
      setEditingTaskNotes(null);
    } catch (err: any) {
      toast.error('Gagal menyimpan catatan.');
    }
  };

  const getTaskBadge = (type: DriverTaskType) => {
    switch (type) {
      case 'relokasi_mesin':
        return {
          label: 'Relokasi Mesin',
          color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
          icon: Truck,
        };
      case 'opsional':
        return {
          label: 'Tugas Opsional',
          color: 'bg-purple-50 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
          icon: Sparkles,
        };
      case 'pasang_baru':
        return {
          label: 'Pasang Baru',
          color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
          icon: PackagePlus,
        };
      case 'tarik_rusak':
        return {
          label: 'Tarik Unit Rusak',
          color: 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
          icon: Wrench,
        };
      case 'antar_koin':
        return {
          label: 'Antar Stok Koin',
          color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
          icon: Coins,
        };
      default:
        return {
          label: 'Tugas Logistik',
          color: 'bg-slate-50 dark:bg-slate-500/10 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-500/30',
          icon: Truck,
        };
    }
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      {activeTab === 'driver_tasks' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                Daftar Tugas Logistik
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                {tasks.length} tiket tugas aktif di {currentBranch?.name || 'Cabang'}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchTasks}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Task Cards List */}
          {tasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-semibold">Semua tugas lapangan telah selesai dikerjakan!</p>
              <p className="text-[11px] text-slate-400 mt-1">Admin Cabang belum menugaskan tiket baru.</p>
            </div>
          ) : (
            tasks.map((task) => {
              const isRelocation = task.task_type === 'relokasi_mesin';
              const isInTransit = task.status === 'in_progress';

              // If in transit during relocation, target store is the destination!
              const currentStore =
                isRelocation && isInTransit && task.target_store
                  ? task.target_store
                  : task.store || task.target_store;

              const storeName = currentStore ? currentStore.name : 'Outlet Mitra';
              const storeAddress = currentStore?.address || 'Alamat belum diinput';
              const storePhone = currentStore?.phone;
              const storeLat = currentStore?.latitude;
              const storeLng = currentStore?.longitude;

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-xs transition-colors"
                >
                  {/* Row 1: [namatoko] [icon intruksi dynamic, muncul hanya ketika ada intruksi] */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {storeName}
                      </h3>
                      {isRelocation && (
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${
                            isInTransit
                              ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {isInTransit ? 'Toko Tujuan' : 'Toko Asal'}
                        </span>
                      )}
                      {task.machine?.machine_code && (
                        <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 flex-shrink-0">
                          {task.machine.machine_code}
                        </span>
                      )}
                    </div>

                    {/* Icon instruksi dynamic, muncul hanya ketika ada instruksi */}
                    {task.notes && (
                      <button
                        type="button"
                        onClick={() => setSelectedInstruction({ storeName, notes: task.notes! })}
                        className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition cursor-pointer flex-shrink-0 flex items-center gap-1 active:scale-95 shadow-2xs"
                        title="Lihat Instruksi Admin"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-extrabold">Instruksi</span>
                      </button>
                    )}
                  </div>

                  {/* Row 2: [alamat] */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{storeAddress}</span>
                  </p>

                  {/* Row 3: [logo wa] [logo maps.png] [icon pensil] [tombol dynamic "Diangkut" dan "Berhasil dipindah"] */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Logo WA */}
                    <a
                      href={storePhone ? `https://wa.me/${storePhone.replace(/[^0-9]/g, '')}` : undefined}
                      onClick={(e) => {
                        if (!storePhone) {
                          e.preventDefault();
                          toast.info('Nomor WhatsApp toko belum terdaftar.');
                        }
                      }}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition border cursor-pointer active:scale-95 shadow-2xs ${
                        storePhone
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700'
                      }`}
                      title={storePhone ? `Chat WA: ${storePhone}` : 'Nomor WA tidak tersedia'}
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.64c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z"/>
                      </svg>
                    </a>

                    {/* Logo Maps.png */}
                    <a
                      href={
                        storeLat && storeLng
                          ? `https://maps.google.com/?q=${storeLat},${storeLng}`
                          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress || storeName)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center flex-shrink-0 transition shadow-2xs cursor-pointer active:scale-95"
                      title="Buka Google Maps"
                    >
                      <img src="/maps.png" alt="Google Maps" className="w-5 h-5 object-contain" />
                    </a>

                    {/* Icon Pensil (Edit Catatan Petugas) */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTaskNotes(task);
                        setTaskNoteInput(task.notes || '');
                      }}
                      className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center flex-shrink-0 transition cursor-pointer active:scale-95 shadow-2xs"
                      title="Edit Catatan Lapangan"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Tombol dynamic "Diangkut" dan "Berhasil dipindah" */}
                    {isRelocation ? (
                      !isInTransit ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAsInTransit(task)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Diangkut</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTaskToExecute(task);
                            setEvidencePhotoBlob(null);
                            setExecutionNotes('');
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Berhasil dipindah</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTaskToExecute(task);
                          setEvidencePhotoBlob(null);
                          setExecutionNotes('');
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
                      >
                        <span>Selesaikan Tugas</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Completed Tasks History Tab */
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Riwayat Tugas Selesai</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total {completedTasks.length} tugas terverifikasi</p>
            </div>
            <button
              type="button"
              onClick={fetchTasks}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {completedTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <Truck className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-xs font-semibold">Belum ada riwayat tugas selesai hari ini.</p>
            </div>
          ) : (
            completedTasks.map((task) => {
              const badge = getTaskBadge(task.task_type);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.color}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      {badge.label}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Selesai
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {task.store ? task.store.name : 'Outlet'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{task.store?.address}</p>
                  </div>

                  {task.photo_evidence_url && (
                    <div className="pt-1">
                      <a
                        href={task.photo_evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Lihat Foto Bukti Lapangan
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Execution Modal */}
      {activeTaskToExecute && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Konfirmasi Selesai Tugas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTaskToExecute(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="font-extrabold text-slate-900 dark:text-white">
                {activeTaskToExecute.store?.name}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {activeTaskToExecute.store?.address}
              </div>
              {activeTaskToExecute.machine && (
                <div className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  Unit: {activeTaskToExecute.machine.machine_code}
                </div>
              )}
            </div>

            {/* Mandatory Evidence Photo Capture */}
            <CameraCapture
              label="Foto Bukti Lapangan (Wajib)"
              subLabel="Ambil foto unit terpasang / nota serah terima langsung di lokasi"
              required={true}
              onPhotoCaptured={({ base64 }) => setEvidencePhotoBlob(base64)}
            />

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Hasil Lapangan (Opsional)
              </label>
              <textarea
                rows={2}
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                placeholder="Misal: Mesin sudah dicolokkan listrik dan uji coba normal..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTaskToExecute(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting || !evidencePhotoBlob}
                onClick={handleCompleteTask}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesaikan Tugas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instruction Viewing Modal */}
      {selectedInstruction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-3.5 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Instruksi Tugas</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstruction(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {selectedInstruction.storeName}
              </span>
              <div className="text-xs text-slate-700 dark:text-slate-300 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/60 leading-relaxed font-medium">
                {selectedInstruction.notes}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedInstruction(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs cursor-pointer transition active:scale-98"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Editing Task Notes Modal */}
      {editingTaskNotes && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-3.5 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Catatan Lapangan</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTaskNotes(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tulis / Edit Catatan untuk Tugas Ini:
              </label>
              <textarea
                rows={3}
                value={taskNoteInput}
                onChange={(e) => setTaskNoteInput(e.target.value)}
                placeholder="Misal: Sudah telepon kasir, parkiran belakang aman..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingTaskNotes(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer active:scale-98"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTaskNote}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 cursor-pointer active:scale-98 transition"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
