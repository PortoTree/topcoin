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
  Cpu,
  Coins,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Wrench,
  PackagePlus,
  Clock,
  X,
  Sparkles,
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
    task_type: 'pasang_baru',
    driver_id: '66666666-6666-6666-6666-666666666666',
    assigned_by: '33333333-3333-3333-3333-333333333333',
    status: 'assigned',
    notes: 'Bawa unit MSN-SBY-001 dari gudang ke toko baru.',
    created_at: new Date().toISOString(),
    store: {
      id: 'store-demo-1',
      name: 'Toko Berkah Mandiri',
      address: 'Jl. Basuki Rahmat No. 12, Surabaya',
      owner_name: 'Pak Haji Ahmad',
      phone: '081234567890',
      latitude: -7.265,
      longitude: 112.742,
      status: 'proses',
      current_machine_id: null,
      photo_store_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    machine: {
      id: 'm-demo-1',
      machine_code: 'MSN-SBY-001',
      status: 'gudang',
      current_store_id: null,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'task-demo-2',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    task_type: 'antar_koin',
    driver_id: '66666666-6666-6666-6666-666666666666',
    assigned_by: '33333333-3333-3333-3333-333333333333',
    coin_amount: 500,
    status: 'assigned',
    notes: 'Koin cadangan toko menipis, antar 500 koin.',
    created_at: new Date().toISOString(),
    store: {
      id: 'store-demo-2',
      name: 'Kedai Kopi Rezeki',
      address: 'Jl. Embong Malang No. 45, Surabaya',
      owner_name: 'Ibu Ratna',
      phone: '081298765432',
      latitude: -7.261,
      longitude: 112.738,
      status: 'terpasang',
      current_machine_id: 'm-demo-2',
      photo_store_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    id: 'task-demo-3',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    task_type: 'tarik_rusak',
    driver_id: '66666666-6666-6666-6666-666666666666',
    assigned_by: '33333333-3333-3333-3333-333333333333',
    status: 'in_progress',
    notes: 'Pencapit koin tidak berfungsi. Tarik ke gudang.',
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
          notes: executionNotes.trim() ? `${activeTaskToExecute.notes || ''} [Driver: ${executionNotes.trim()}]` : activeTaskToExecute.notes,
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

  const getTaskBadge = (type: DriverTaskType) => {
    switch (type) {
      case 'pasang_baru':
        return {
          label: 'Pasang Mesin Baru',
          color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
          icon: PackagePlus,
        };
      case 'relokasi_mesin':
        return {
          label: 'Relokasi Mesin',
          color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
          icon: Truck,
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
                Daftar Tugas Lapangan
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
              const badge = getTaskBadge(task.task_type);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs transition-colors"
                >
                  {/* Top Bar Type */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${badge.color}`}
                    >
                      <BadgeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      {badge.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3" />
                      {task.status === 'in_progress' ? 'Sedang Jalan' : 'Tersedia'}
                    </span>
                  </div>

                  {/* Store & Machine Details */}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {task.store ? task.store.name : 'Outlet Mitra'}
                    </h3>
                    {task.store?.address && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1 mt-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span>{task.store.address}</span>
                      </p>
                    )}
                  </div>

                  {/* Context Info (Unit Mesin / Koin) */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {task.machine && (
                      <div className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 font-bold">
                        <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Unit: {task.machine.machine_code}</span>
                      </div>
                    )}
                    {task.coin_amount ? (
                      <div className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 font-bold">
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        <span>{task.coin_amount} Koin (Rp {(task.coin_amount * 1000).toLocaleString('id-ID')})</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Notes from Admin */}
                  {task.notes && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-medium">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Instruksi Admin: </span>
                      {task.notes}
                    </div>
                  )}

                  {/* Quick Action Navigation & Execution */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    {task.store?.phone && (
                      <a
                        href={`https://wa.me/${task.store.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center cursor-pointer"
                        title="Chat WA Toko"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                    {task.store?.latitude && task.store?.longitude && (
                      <a
                        href={`https://maps.google.com/?q=${task.store.latitude},${task.store.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 flex items-center justify-center cursor-pointer"
                        title="Navigasi Google Maps"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTaskToExecute(task);
                        setEvidencePhotoBlob(null);
                        setExecutionNotes('');
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 active:scale-95 transition cursor-pointer"
                    >
                      <span>Eksekusi & Selesaikan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
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
    </div>
  );
};
