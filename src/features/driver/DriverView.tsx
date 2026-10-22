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
  Navigation,
  Gauge,
  Clock,
  Info,
  Phone,
  Users,
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

  // Execution Modal State (Non-relocation tasks)
  const [activeTaskToExecute, setActiveTaskToExecute] = useState<DriverTask | null>(null);
  const [evidencePhotoBlob, setEvidencePhotoBlob] = useState<Blob | string | null>(null);
  const [executionNotes, setExecutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Relocation Pickup Modal State ("Diangkut" -> in_progress)
  const [pickupTaskToExecute, setPickupTaskToExecute] = useState<DriverTask | null>(null);
  const [pickupPhotoBlob, setPickupPhotoBlob] = useState<Blob | string | null>(null);
  const [pickupNotes, setPickupNotes] = useState('');
  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);

  // 2. Relocation Delivery Modal State ("Dikirim" -> completed)
  const [deliveryTaskToExecute, setDeliveryTaskToExecute] = useState<DriverTask | null>(null);
  const [deliveryPhotoBlob, setDeliveryPhotoBlob] = useState<Blob | string | null>(null);
  const [deliveryCoinMeter, setDeliveryCoinMeter] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // 3. Relocation Summary Modal State ("Berhasil dipindah")
  const [summaryTask, setSummaryTask] = useState<DriverTask | null>(null);

  // 4. Task Information Detail Modal State
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<DriverTask | null>(null);

  // Store Closed Modal State
  const [reportingClosedTask, setReportingClosedTask] = useState<DriverTask | null>(null);
  const [closedReasonInput, setClosedReasonInput] = useState('');
  const [isSubmittingClosedReport, setIsSubmittingClosedReport] = useState(false);

  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const fetchTasks = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .select(`
          *,
          store:stores!store_id(*),
          target_store:stores!target_store_id(*),
          machine:machines(*)
        `)
        .eq('branch_id', activeBranchId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const allTasks = data as DriverTask[];
        // Filter to tasks assigned to this driver (either as primary driver or member of the assigned team officer_ids)
        const myTasks =
          profile.role === 'logistik' || profile.role === 'driver'
            ? allTasks.filter(
                (t) =>
                  t.driver_id === profile.id ||
                  (Array.isArray(t.officer_ids) && t.officer_ids.includes(profile.id))
              )
            : allTasks;
        const displayTasks = myTasks.length > 0 ? myTasks : allTasks;

        setTasks(displayTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'));
        setCompletedTasks(displayTasks.filter((t) => t.status === 'completed'));
      } else if (error) {
        console.warn('Driver tasks fetch fallback:', error);
        setTasks(DEMO_DRIVER_TASKS.filter((t) => t.status !== 'completed'));
        setCompletedTasks([]);
      }
    } catch (err) {
      console.error('Error fetching driver tasks:', err);
      setTasks(DEMO_DRIVER_TASKS.filter((t) => t.status !== 'completed'));
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, profile?.role, activeBranchId]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`driver_tasks_realtime_view_${activeBranchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_tasks' },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, activeBranchId]);

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

  // 1. Confirm Machine Pickup ("Diangkut" -> in_progress)
  const handleConfirmPickup = async () => {
    if (!pickupTaskToExecute || isSubmittingPickup) return;
    setIsSubmittingPickup(true);
    try {
      let photoUrl: string | null = null;
      if (pickupPhotoBlob) {
        photoUrl = await uploadToCloudinary(pickupPhotoBlob, 'driver_tasks');
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('driver_tasks')
        .update({
          status: 'in_progress',
          pickup_photo_url: photoUrl,
          pickup_notes: pickupNotes.trim() || null,
          pickup_at: now,
        })
        .eq('id', pickupTaskToExecute.id);

      if (error) console.warn('DB update pickup fallback:', error);

      const updatedTask: DriverTask = {
        ...pickupTaskToExecute,
        status: 'in_progress',
        pickup_photo_url: photoUrl,
        pickup_notes: pickupNotes.trim() || null,
        pickup_at: now,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === pickupTaskToExecute.id ? updatedTask : t))
      );

      toast.success('Mesin berhasil diangkut! Mengarahkan ke toko tujuan.');
      setPickupTaskToExecute(null);
      setPickupPhotoBlob(null);
      setPickupNotes('');
    } catch (err: any) {
      console.error('Error confirming pickup:', err);
      toast.error(err.message || 'Gagal memproses pengangkutan mesin.');
    } finally {
      setIsSubmittingPickup(false);
    }
  };

  // 2. Confirm Machine Delivery ("Dikirim" -> completed)
  const handleConfirmDelivery = async () => {
    if (!deliveryTaskToExecute || isSubmittingDelivery) return;
    setIsSubmittingDelivery(true);
    try {
      let photoUrl: string | null = null;
      if (deliveryPhotoBlob) {
        photoUrl = await uploadToCloudinary(deliveryPhotoBlob, 'driver_tasks');
      }
      const now = new Date().toISOString();
      const meterVal = deliveryCoinMeter.trim() ? parseInt(deliveryCoinMeter, 10) : null;

      const { error: taskErr } = await supabase
        .from('driver_tasks')
        .update({
          status: 'completed',
          photo_evidence_url: photoUrl,
          last_coin_meter: isNaN(meterVal as number) ? null : meterVal,
          delivery_notes: deliveryNotes.trim() || null,
          completed_at: now,
        })
        .eq('id', deliveryTaskToExecute.id);

      if (taskErr) console.warn('DB update delivery fallback:', taskErr);

      // Auto update store & machine
      if (deliveryTaskToExecute.target_store_id && deliveryTaskToExecute.machine_id) {
        await supabase
          .from('machines')
          .update({ current_store_id: deliveryTaskToExecute.target_store_id })
          .eq('id', deliveryTaskToExecute.machine_id);
        await supabase
          .from('stores')
          .update({
            current_machine_id: deliveryTaskToExecute.machine_id,
            status: 'terpasang',
          })
          .eq('id', deliveryTaskToExecute.target_store_id);
      }

      // Confetti feedback
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {
        // ignore
      }

      const updatedTask: DriverTask = {
        ...deliveryTaskToExecute,
        status: 'completed',
        photo_evidence_url: photoUrl,
        last_coin_meter: isNaN(meterVal as number) ? null : meterVal,
        delivery_notes: deliveryNotes.trim() || null,
        completed_at: now,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === deliveryTaskToExecute.id ? updatedTask : t))
      );
      setCompletedTasks((prev) => [updatedTask, ...prev]);

      toast.success('Tugas relokasi selesai! Mesin berhasil dipindahkan.');
      setDeliveryTaskToExecute(null);
      setDeliveryPhotoBlob(null);
      setDeliveryCoinMeter('');
      setDeliveryNotes('');
    } catch (err: any) {
      console.error('Error confirming delivery:', err);
      toast.error(err.message || 'Gagal menyelesaikan tugas relokasi.');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Save Store Closed Report
  const handleSaveClosedReport = async () => {
    if (!reportingClosedTask || isSubmittingClosedReport) return;
    setIsSubmittingClosedReport(true);
    try {
      const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const closedTag = `[TOKO TUTUP ${nowTime}]: ${closedReasonInput.trim()}`;
      const updatedNotes = reportingClosedTask.notes
        ? `${reportingClosedTask.notes}\n${closedTag}`
        : closedTag;

      const { error } = await supabase
        .from('driver_tasks')
        .update({ notes: updatedNotes })
        .eq('id', reportingClosedTask.id);

      if (error) console.warn('DB update store closed report fallback:', error);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === reportingClosedTask.id ? { ...t, notes: updatedNotes } : t
        )
      );
      toast.success('Laporan toko tutup berhasil dikirim ke Admin Cabang!');
      setReportingClosedTask(null);
    } catch (err: any) {
      console.error('Error reporting closed store:', err);
      toast.error('Gagal mengirim laporan toko tutup.');
    } finally {
      setIsSubmittingClosedReport(false);
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
          {/* Header (Unboxed, clean divider) */}
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-95 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Task Cards List */}
          {tasks.length === 0 ? (
            <div className="py-14 text-center text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2.5 opacity-90" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Semua tugas lapangan telah selesai dikerjakan!
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Admin Cabang belum menugaskan tiket baru.</p>
            </div>
          ) : (
            tasks.map((task) => {
              const isRelocation = task.task_type === 'relokasi_mesin';
              const isInTransit = task.status === 'in_progress';
              const isCompleted = task.status === 'completed';

              // Saat belum diangkut ('assigned') -> currentStore adalah Toko Asal (task.store)
              // Saat sudah diangkut ('in_progress' atau 'completed') -> currentStore adalah Toko Tujuan (task.target_store || task.store)
              const currentStore =
                isRelocation && (isInTransit || isCompleted) && task.target_store
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
                  {/* Row 1: [namatoko] [icon intruksi dynamic] ----------- [nomor mesin] */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {storeName}
                      </h3>
                    </div>

                    {/* Nomor mesin berada di kanan (tukar posisi dengan instruksi) */}
                    {task.machine?.machine_code && (
                      <span className="text-xs font-black tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 flex-shrink-0 shadow-2xs">
                        {task.machine.machine_code}
                      </span>
                    )}
                  </div>

                  {/* Row 2: [alamat] */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{storeAddress}</span>
                  </p>

                  {/* Row 3: [logo wa] [logo maps.png] [icon pensil] [tombol dynamic] */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Logo WA (pakai whatsapp.png) */}
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
                      className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center flex-shrink-0 transition shadow-2xs cursor-pointer active:scale-95 ${
                        !storePhone ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title={storePhone ? `Chat WA: ${storePhone}` : 'Nomor WA tidak tersedia'}
                    >
                      <img src="/whatsapp.png" alt="WhatsApp" className="w-5 h-5 object-contain" />
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

                    {/* Icon Info (Modal Detail Lengkap Tugas & Rute) */}
                    <button
                      type="button"
                      onClick={() => setSelectedTaskForDetail(task)}
                      className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 transition cursor-pointer active:scale-95 shadow-2xs group"
                      title="Lihat Informasi Lengkap Tugas"
                    >
                      <Info className="w-5 h-5 transition-transform group-hover:scale-110" />
                    </button>

                    {/* Tombol dynamic: 1. Diangkut -> 2. Dikirim -> 3. Berhasil dipindah */}
                    {isRelocation ? (
                      task.status === 'assigned' ? (
                        /* 1. Diangkut (Hitam Putih) */
                        <button
                          type="button"
                          onClick={() => {
                            setPickupTaskToExecute(task);
                            setPickupPhotoBlob(null);
                            setPickupNotes('');
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/15 dark:shadow-white/10 active:scale-95 transition cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Diangkut</span>
                        </button>
                      ) : task.status === 'in_progress' ? (
                        /* 2. Dikirim (Warna Biru) */
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryTaskToExecute(task);
                            setDeliveryPhotoBlob(null);
                            setDeliveryCoinMeter('');
                            setDeliveryNotes('');
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Dikirim</span>
                        </button>
                      ) : (
                        /* 3. Berhasil dipindah (Hijau Emerald -> Trigger Summary) */
                        <button
                          type="button"
                          onClick={() => setSummaryTask(task)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
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

                  {/* Tombol Lihat Ringkasan Relokasi */}
                  {task.task_type === 'relokasi_mesin' && (
                    <button
                      type="button"
                      onClick={() => setSummaryTask(task)}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lihat Ringkasan Relokasi</span>
                    </button>
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

      {/* 1. Modal Pengangkutan Mesin ("Diangkut" -> in_progress) */}
      {pickupTaskToExecute && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-900 dark:text-white" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Pengangkutan Mesin (Toko Asal)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPickupTaskToExecute(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {pickupTaskToExecute.store?.name}
                </span>
                {pickupTaskToExecute.machine && (
                  <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                    {pickupTaskToExecute.machine.machine_code}
                  </span>
                )}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {pickupTaskToExecute.store?.address}
              </div>
            </div>

            {/* Camera Capture (Opsional) */}
            <CameraCapture
              label="Foto Bukti Pengangkutan (Opsional)"
              subLabel="Ambil foto mesin saat diangkut dari toko asal"
              required={false}
              onPhotoCaptured={({ base64 }) => setPickupPhotoBlob(base64)}
            />

            {/* Catatan (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Pengangkutan (Opsional)
              </label>
              <textarea
                rows={2}
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder="Misal: Mesin sudah dinaikkan ke armada pick-up, kondisi aman..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>

            {/* Submit Action: "Berhasil diangkut" */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPickupTaskToExecute(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingPickup}
                onClick={handleConfirmPickup}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-slate-900/20 active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingPickup ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Berhasil diangkut</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Pengiriman Mesin ("Dikirim" -> completed) */}
      {deliveryTaskToExecute && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Penempatan di Toko Tujuan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryTaskToExecute(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-950 dark:text-blue-200">
                  {deliveryTaskToExecute.target_store?.name || deliveryTaskToExecute.store?.name}
                </span>
                {deliveryTaskToExecute.machine && (
                  <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                    {deliveryTaskToExecute.machine.machine_code}
                  </span>
                )}
              </div>
              <div className="text-blue-800/80 dark:text-blue-300">
                {deliveryTaskToExecute.target_store?.address || deliveryTaskToExecute.store?.address}
              </div>
            </div>

            {/* Camera Capture (Opsional) */}
            <CameraCapture
              label="Foto Bukti Penempatan (Opsional)"
              subLabel="Ambil foto mesin yang sudah terpasang di toko tujuan"
              required={false}
              onPhotoCaptured={({ base64 }) => setDeliveryPhotoBlob(base64)}
            />

            {/* Kolom Nomor Meteran Koin Terakhir (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nomor Meteran Koin Terakhir (Opsional)
              </label>
              <div className="relative">
                <Gauge className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="number"
                  value={deliveryCoinMeter}
                  onChange={(e) => setDeliveryCoinMeter(e.target.value)}
                  placeholder="Misal: 14250"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Catat angka counter meter fisik yang tertera di mesin saat serah terima.
              </span>
            </div>

            {/* Catatan (Opsional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Penempatan (Opsional)
              </label>
              <textarea
                rows={2}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Misal: Sudah ditest colok listrik & koin berjalan lancar..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Action: "Selesaikan tugas" */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeliveryTaskToExecute(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingDelivery}
                onClick={handleConfirmDelivery}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/25 active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDelivery ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesaikan tugas</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Ringkasan Relokasi ("Berhasil dipindah" -> Summary) */}
      {summaryTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Ringkasan Relokasi Mesin
                  </h3>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Tugas Berhasil Diselesaikan
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSummaryTask(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Machine Badge */}
            {summaryTask.machine && (
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-500 font-bold">Unit Mesin:</span>
                <span className="font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600">
                  {summaryTask.machine.machine_code}
                </span>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-4 pt-1">
              {/* Step 1: Diangkut (Toko Asal) */}
              <div className="relative pl-6 border-l-2 border-slate-300 dark:border-slate-700 space-y-2">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-[9px] font-black">
                  1
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Tahap 1: Diangkut
                  </span>
                  {summaryTask.pickup_at && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(summaryTask.pickup_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <div className="text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {summaryTask.store?.name || 'Toko Asal'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {summaryTask.store?.address}
                  </div>
                  {summaryTask.pickup_notes && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <strong>Catatan:</strong> {summaryTask.pickup_notes}
                    </div>
                  )}
                  {summaryTask.pickup_photo_url ? (
                    <a
                      href={summaryTask.pickup_photo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Lihat Foto Bukti Pengangkutan
                    </a>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      Tidak menyertakan foto pengangkutan
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Dikirim & Selesai (Toko Tujuan) */}
              <div className="relative pl-6 border-l-2 border-emerald-500 space-y-2">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-black">
                  2
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Tahap 2: Selesai Dikirim & Ditempatkan
                  </span>
                  {summaryTask.completed_at && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {new Date(summaryTask.completed_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <div className="text-xs bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {summaryTask.target_store?.name || summaryTask.store?.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {summaryTask.target_store?.address || summaryTask.store?.address}
                  </div>
                  {/* Meteran Koin Terakhir */}
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                      Meteran Koin Terakhir:
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {summaryTask.last_coin_meter != null
                        ? `${summaryTask.last_coin_meter.toLocaleString('id-ID')} koin`
                        : 'Tidak dicatat'}
                    </span>
                  </div>
                  {summaryTask.delivery_notes && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <strong>Catatan:</strong> {summaryTask.delivery_notes}
                    </div>
                  )}
                  {summaryTask.photo_evidence_url ? (
                    <a
                      href={summaryTask.photo_evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Lihat Foto Bukti Penempatan
                    </a>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      Tidak menyertakan foto penempatan
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSummaryTask(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs cursor-pointer transition active:scale-98"
            >
              Tutup Ringkasan
            </button>
          </div>
        </div>
      )}



      {/* Modal Informasi Lengkap Tugas Logistik */}
      {selectedTaskForDetail && (() => {
        const t = selectedTaskForDetail;
        const originStore = t.store;
        const targetStore = t.target_store;
        const machine = t.machine;

        const teamInfo = t.notes?.match(/\[Tim Logistik: ([^\]]+)\]/);
        const assignedStaffText = teamInfo ? teamInfo[1] : (t.driver?.full_name || 'Petugas Lapangan');

        const cleanNotes = t.notes?.replace(/\[Tim Logistik: [^\]]+\]\s*/, '').trim();

        // Origin Store Contact & Map
        const originPhone = originStore?.phone;
        const originWaUrl = originPhone ? `https://wa.me/${originPhone.replace(/[^0-9]/g, '')}` : undefined;
        const originMapUrl =
          originStore?.latitude && originStore?.longitude
            ? `https://maps.google.com/?q=${originStore.latitude},${originStore.longitude}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(originStore?.address || originStore?.name || 'Toko Asal')}`;

        // Target Store Contact & Map
        const targetPhone = targetStore?.phone;
        const targetWaUrl = targetPhone ? `https://wa.me/${targetPhone.replace(/[^0-9]/g, '')}` : undefined;
        const targetMapUrl =
          targetStore?.latitude && targetStore?.longitude
            ? `https://maps.google.com/?q=${targetStore.latitude},${targetStore.longitude}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetStore?.address || targetStore?.name || 'Toko Tujuan')}`;

        return (
          <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col animate-in fade-in duration-200 overflow-hidden">
            {/* Fullscreen Sticky Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Informasi Lengkap Tugas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Rute relokasi & kontak PIC outlet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskForDetail(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-90 transition"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-2xl mx-auto w-full">

              {/* Status & Mesin Badge */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Unit Mesin
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    {machine?.machine_code || 'MSN-UNKNOWN'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Status Tugas
                  </span>
                  <span
                    className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full capitalize ${
                      t.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : t.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}
                  >
                    {t.status === 'in_progress' ? 'Diangkut / Jalan' : t.status === 'assigned' ? 'Ditugaskan' : 'Selesai'}
                  </span>
                </div>
              </div>

              {/* Petugas Tim */}
              <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block">
                    Petugas Logistik
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white truncate block">
                    {assignedStaffText}
                  </span>
                </div>
              </div>

              {/* RUTE 1: Rute Awal (Asal Mesin) */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-amber-300 dark:border-amber-700/60 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-black text-[10px] flex items-center justify-center">
                      A
                    </span>
                    <span className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-300 tracking-wide">
                      Rute Awal
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Titik Ambil</span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {originStore?.name || 'Toko Mitra Asal'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {originStore?.address || 'Alamat toko asal belum terdata.'}
                  </p>
                </div>

                {/* Action WA & Maps Toko Asal */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={originWaUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!originWaUrl) {
                        e.preventDefault();
                        toast.info('Nomor WA toko asal belum terdaftar.');
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition ${
                      originWaUrl
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <img src="/whatsapp.png" alt="WA" className="w-4 h-4 object-contain" />
                    <span className="truncate">{originPhone || 'WhatsApp'}</span>
                  </a>

                  <a
                    href={originMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 hover:bg-blue-100 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
                  >
                    <img src="/maps.png" alt="Maps" className="w-4 h-4 object-contain" />
                    <span>Rute Awal</span>
                  </a>
                </div>
              </div>

              {/* Rute Connector Panah */}
              <div className="flex items-center justify-center -my-1 text-slate-400 dark:text-slate-500">
                <ArrowRight className="w-4 h-4 rotate-90" />
              </div>

              {/* RUTE 2: Rute Antar */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-indigo-300 dark:border-indigo-700/60 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center">
                      B
                    </span>
                    <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wide">
                      Rute Antar
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">Titik Pasang</span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {targetStore?.name || 'Toko Mitra Penerima'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {targetStore?.address || 'Alamat toko tujuan belum terdata.'}
                  </p>
                </div>

                {/* Action WA & Maps Toko Tujuan */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={targetWaUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (!targetWaUrl) {
                        e.preventDefault();
                        toast.info('Nomor WA toko tujuan belum terdaftar.');
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition ${
                      targetWaUrl
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <img src="/whatsapp.png" alt="WA" className="w-4 h-4 object-contain" />
                    <span className="truncate">{targetPhone || 'WhatsApp'}</span>
                  </a>

                  <a
                    href={targetMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 hover:bg-blue-100 flex items-center justify-center gap-1.5 text-xs font-bold transition cursor-pointer"
                  >
                    <img src="/maps.png" alt="Maps" className="w-4 h-4 object-contain" />
                    <span>Rute Antar</span>
                  </a>
                </div>
              </div>

              {/* Catatan / Instruksi jika ada */}
              {cleanNotes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Catatan Tambahan
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {cleanNotes}
                  </p>
                </div>
              )}

            </div>

            {/* Fullscreen Sticky Footer */}
            <div className="p-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-10">
              <div className="max-w-2xl mx-auto w-full">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForDetail(null)}
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs cursor-pointer active:scale-98 transition shadow-md"
                >
                  Tutup Informasi
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
