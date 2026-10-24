import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { CameraCapture } from '../../components/CameraCapture';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { BottomSheetModal } from '../../components/BottomSheetModal';
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
  Navigation,
  Gauge,
  Clock,
  Info,
  Users,
  Zap,
  AlertTriangle,
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

  // 1. Relocation Pickup Modal State ("Diangkut" -> in_progress atau kendala)
  const [pickupTaskToExecute, setPickupTaskToExecute] = useState<DriverTask | null>(null);
  const [pickupPhotoBlob, setPickupPhotoBlob] = useState<Blob | string | null>(null);
  const [pickupNotes, setPickupNotes] = useState('');
  const [hasPickupIssue, setHasPickupIssue] = useState(false);
  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);

  // 2. Relocation Delivery Modal State ("Dikirim" -> completed atau kendala)
  const [deliveryTaskToExecute, setDeliveryTaskToExecute] = useState<DriverTask | null>(null);
  const [deliveryPhotoBlob, setDeliveryPhotoBlob] = useState<Blob | string | null>(null);
  const [deliveryCoinMeter, setDeliveryCoinMeter] = useState('');
  const [deliveryCoinAmount, setDeliveryCoinAmount] = useState('');
  const [deliveryElectricityFee, setDeliveryElectricityFee] = useState('75000');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [hasDeliveryIssue, setHasDeliveryIssue] = useState(false);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // 3. Relocation Summary Modal State ("Berhasil dipindah")
  const [summaryTask, setSummaryTask] = useState<DriverTask | null>(null);

  // 4. Task Information Detail Modal State
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<DriverTask | null>(null);



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

        // Tampilkan semua tugas aktif dan tugas selesai (hanya kecualikan yang cancelled)
        // Urutkan tugas aktif (assigned / in_progress) di atas, lalu tugas selesai di bawah
        const sortedDisplayTasks = [...displayTasks]
          .filter((t) => t.status !== 'cancelled')
          .sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

        setTasks(sortedDisplayTasks);
        setCompletedTasks(displayTasks.filter((t) => t.status === 'completed'));
      } else if (error) {
        console.warn('Driver tasks fetch fallback:', error);
        const sortedDemo = [...DEMO_DRIVER_TASKS]
          .filter((t) => t.status !== 'cancelled')
          .sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        setTasks(sortedDemo);
        setCompletedTasks(DEMO_DRIVER_TASKS.filter((t) => t.status === 'completed'));
      }
    } catch (err) {
      console.error('Error fetching driver tasks:', err);
      const sortedDemo = [...DEMO_DRIVER_TASKS]
        .filter((t) => t.status !== 'cancelled')
        .sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      setTasks(sortedDemo);
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

      const updatedTask: DriverTask = {
        ...activeTaskToExecute,
        status: 'completed',
        photo_evidence_url: photoUrl,
        notes: executionNotes.trim() ? `${activeTaskToExecute.notes || ''} [Logistik: ${executionNotes.trim()}]` : activeTaskToExecute.notes,
        completed_at: new Date().toISOString(),
      };

      // Tetap pertahankan kartu di daftar tugas utama dengan status 'completed'
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === activeTaskToExecute.id ? updatedTask : t));
        return next.sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
      setCompletedTasks((prev) => [updatedTask, ...prev.filter((t) => t.id !== updatedTask.id)]);

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
      setHasPickupIssue(false);
    } catch (err: any) {
      console.error('Error confirming pickup:', err);
      toast.error(err.message || 'Gagal memproses pengangkutan mesin.');
    } finally {
      setIsSubmittingPickup(false);
    }
  };

  // 1b. Report Issue during Pickup ("Laporkan kendala" -> status: 'kendala')
  const handleReportPickupIssue = async () => {
    if (!pickupTaskToExecute || isSubmittingPickup) return;
    if (!pickupNotes.trim()) {
      toast.warning('Silakan isi catatan kendala terlebih dahulu agar admin cabang dapat memprosesnya!');
      return;
    }
    setIsSubmittingPickup(true);
    try {
      let photoUrl: string | null = null;
      if (pickupPhotoBlob) {
        photoUrl = await uploadToCloudinary(pickupPhotoBlob, 'driver_tasks');
      }
      const issueNote = `[KENDALA PENGANGKUTAN] ${pickupNotes.trim()}`;
      const { error } = await supabase
        .from('driver_tasks')
        .update({
          status: 'kendala',
          pickup_photo_url: photoUrl,
          pickup_notes: issueNote,
          notes: issueNote,
        })
        .eq('id', pickupTaskToExecute.id);

      if (error) console.warn('DB update kendala pickup fallback:', error);

      const updatedTask: DriverTask = {
        ...pickupTaskToExecute,
        status: 'kendala',
        pickup_photo_url: photoUrl,
        pickup_notes: issueNote,
        notes: issueNote,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === pickupTaskToExecute.id ? updatedTask : t))
      );

      toast.success('Kendala pengangkutan berhasil dilaporkan ke Admin Cabang.');
      setPickupTaskToExecute(null);
      setPickupPhotoBlob(null);
      setPickupNotes('');
      setHasPickupIssue(false);
    } catch (err: any) {
      console.error('Error reporting pickup issue:', err);
      toast.error(err.message || 'Gagal melaporkan kendala.');
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
      const coinVal = deliveryCoinAmount.trim() ? parseInt(deliveryCoinAmount, 10) : 0;
      const parsedElectricity = deliveryElectricityFee.replace(/[^0-9]/g, '');
      const electricityVal = parsedElectricity.trim() ? parseInt(parsedElectricity, 10) : 75000;

      const { error: taskErr } = await supabase
        .from('driver_tasks')
        .update({
          status: 'completed',
          photo_evidence_url: photoUrl,
          last_coin_meter: isNaN(meterVal as number) ? null : meterVal,
          coin_amount: isNaN(coinVal) ? 0 : coinVal,
          electricity_fee: isNaN(electricityVal) ? 75000 : electricityVal,
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
        coin_amount: isNaN(coinVal) ? 0 : coinVal,
        electricity_fee: isNaN(electricityVal) ? 75000 : electricityVal,
        delivery_notes: deliveryNotes.trim() || null,
        completed_at: now,
      };

      // Tetap pertahankan kartu di daftar tugas utama dengan status 'completed'
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === deliveryTaskToExecute.id ? updatedTask : t));
        return next.sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
      setCompletedTasks((prev) => [updatedTask, ...prev.filter((t) => t.id !== updatedTask.id)]);

      toast.success('Tugas relokasi selesai! Mesin berhasil dipindahkan.');
      setDeliveryTaskToExecute(null);
      setDeliveryPhotoBlob(null);
      setDeliveryCoinMeter('');
      setDeliveryCoinAmount('');
      setDeliveryElectricityFee('75000');
      setDeliveryNotes('');
      setHasDeliveryIssue(false);
    } catch (err: any) {
      console.error('Error confirming delivery:', err);
      toast.error(err.message || 'Gagal menyelesaikan tugas relokasi.');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // 2b. Report Issue during Delivery ("Laporkan kendala" -> status: 'kendala')
  const handleReportDeliveryIssue = async () => {
    if (!deliveryTaskToExecute || isSubmittingDelivery) return;
    if (!deliveryNotes.trim()) {
      toast.warning('Silakan isi catatan kendala terlebih dahulu agar admin cabang dapat memprosesnya!');
      return;
    }
    setIsSubmittingDelivery(true);
    try {
      let photoUrl: string | null = null;
      if (deliveryPhotoBlob) {
        photoUrl = await uploadToCloudinary(deliveryPhotoBlob, 'driver_tasks');
      }
      const meterVal = deliveryCoinMeter.trim() ? parseInt(deliveryCoinMeter, 10) : null;
      const coinVal = deliveryCoinAmount.trim() ? parseInt(deliveryCoinAmount, 10) : 0;
      const parsedElectricity = deliveryElectricityFee.replace(/[^0-9]/g, '');
      const electricityVal = parsedElectricity.trim() ? parseInt(parsedElectricity, 10) : 75000;
      const issueNote = `[KENDALA PENEMPATAN] ${deliveryNotes.trim()}`;

      const { error: taskErr } = await supabase
        .from('driver_tasks')
        .update({
          status: 'kendala',
          photo_evidence_url: photoUrl,
          last_coin_meter: isNaN(meterVal as number) ? null : meterVal,
          coin_amount: isNaN(coinVal) ? 0 : coinVal,
          electricity_fee: isNaN(electricityVal) ? 75000 : electricityVal,
          delivery_notes: issueNote,
          notes: issueNote,
        })
        .eq('id', deliveryTaskToExecute.id);

      if (taskErr) console.warn('DB update kendala delivery fallback:', taskErr);

      const updatedTask: DriverTask = {
        ...deliveryTaskToExecute,
        status: 'kendala',
        photo_evidence_url: photoUrl,
        last_coin_meter: isNaN(meterVal as number) ? null : meterVal,
        coin_amount: isNaN(coinVal) ? 0 : coinVal,
        electricity_fee: isNaN(electricityVal) ? 75000 : electricityVal,
        delivery_notes: issueNote,
        notes: issueNote,
      };

      setTasks((prev) =>
        prev.map((t) => (t.id === deliveryTaskToExecute.id ? updatedTask : t))
      );

      toast.success('Kendala penempatan berhasil dilaporkan ke Admin Cabang.');
      setDeliveryTaskToExecute(null);
      setDeliveryPhotoBlob(null);
      setDeliveryCoinMeter('');
      setDeliveryCoinAmount('');
      setDeliveryElectricityFee('75000');
      setDeliveryNotes('');
      setHasDeliveryIssue(false);
    } catch (err: any) {
      console.error('Error reporting delivery issue:', err);
      toast.error(err.message || 'Gagal melaporkan kendala.');
    } finally {
      setIsSubmittingDelivery(false);
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
                {tasks.filter((t) => t.status !== 'completed').length} tugas aktif •{' '}
                {tasks.filter((t) => t.status === 'completed').length} selesai
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
              const isKendala = task.status === 'kendala';

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
                  onClick={() => {
                    if (isCompleted) {
                      setSummaryTask(task);
                    } else if (isKendala) {
                      setSelectedTaskForDetail(task);
                    }
                  }}
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-4 space-y-2.5 shadow-xs transition-all ${
                    isCompleted
                      ? 'border-2 border-emerald-400/90 dark:border-emerald-600/90 hover:border-emerald-500 dark:hover:border-emerald-400 bg-emerald-50/15 dark:bg-emerald-950/20 cursor-pointer active:scale-99'
                      : isKendala
                      ? 'border-2 border-rose-400/90 dark:border-rose-600/90 bg-rose-50/15 dark:bg-rose-950/20 cursor-pointer'
                      : 'border-2 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {/* Row 1: [namatoko] [badge status selesai/kendala jika ada] ----------- [nomor mesin] */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                        {storeName}
                      </h3>
                    </div>

                    {/* Nomor mesin berada di kanan */}
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

                  {/* Indikator Waktu Status Selesai jika task sudah completed */}
                  {isCompleted && task.completed_at && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/80 w-fit">
                      <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Selesai pada:{' '}
                        {new Date(task.completed_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}

                  {/* Indikator Peringatan Kendala Lapangan */}
                  {isKendala && (
                    <div className="flex items-start gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/80">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-0.5 min-w-0">
                        <span className="block font-black text-xs">Status: Kendala Lapangan</span>
                        <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 block break-words">
                          {task.notes || task.delivery_notes || task.pickup_notes || 'Menunggu penanganan lebih lanjut dari tim logistik/admin.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Row 3: [logo wa] [logo maps.png] [icon info] [tombol dynamic] */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Logo WA (pakai whatsapp.png) */}
                    <a
                      href={storePhone ? `https://wa.me/${storePhone.replace(/[^0-9]/g, '')}` : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
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
                      onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTaskForDetail(task);
                      }}
                      className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 transition cursor-pointer active:scale-95 shadow-2xs group"
                      title="Lihat Informasi Lengkap Tugas"
                    >
                      <Info className="w-5 h-5 transition-transform group-hover:scale-110" />
                    </button>

                    {/* Tombol dynamic: 1. Diangkut -> 2. Dikirim -> 3. Berhasil dipindah / Kendala */}
                    {isRelocation ? (
                      task.status === 'assigned' ? (
                        /* 1. Diangkut (Hitam Putih) */
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickupTaskToExecute(task);
                            setPickupPhotoBlob(null);
                            setPickupNotes('');
                            setHasPickupIssue(false);
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeliveryTaskToExecute(task);
                            setDeliveryPhotoBlob(null);
                            setDeliveryCoinMeter('');
                            setDeliveryCoinAmount(task.coin_amount ? String(task.coin_amount) : '');
                            setDeliveryElectricityFee(task.electricity_fee != null ? String(task.electricity_fee) : '75000');
                            setDeliveryNotes('');
                            setHasDeliveryIssue(false);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Dikirim</span>
                        </button>
                      ) : task.status === 'kendala' ? (
                        /* Status Kendala Lapangan */
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTaskForDetail(task);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Lihat Kendala</span>
                        </button>
                      ) : (
                        /* 3. Berhasil dipindah (Hijau Emerald -> Trigger Summary) */
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSummaryTask(task);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Berhasil dipindah</span>
                        </button>
                      )
                    ) : (
                      task.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSummaryTask(task);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Lihat Ringkasan Selesai</span>
                        </button>
                      ) : task.status === 'kendala' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTaskForDetail(task);
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Lihat Kendala</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTaskToExecute(task);
                            setEvidencePhotoBlob(null);
                            setExecutionNotes('');
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
                        >
                          <span>Selesaikan Tugas</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )
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
              const isRelocation = task.task_type === 'relokasi_mesin';
              const displayStore = isRelocation && task.target_store ? task.target_store : task.store;

              return (
                <div
                  key={task.id}
                  onClick={() => setSummaryTask(task)}
                  className="bg-white dark:bg-slate-900 border-2 border-emerald-400/90 dark:border-emerald-600/90 hover:border-emerald-500 dark:hover:border-emerald-400 rounded-2xl p-4 space-y-2.5 shadow-xs transition-all cursor-pointer active:scale-[0.99] group bg-emerald-50/10 dark:bg-emerald-950/20"
                >
                  {/* Row 1: Badge Tipe Tugas & Status Selesai, Nomor Mesin di Kanan */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
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

                    {task.machine?.machine_code && (
                      <span className="text-xs font-black tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-2.5 py-0.5 rounded-lg border border-slate-300 dark:border-slate-600 flex-shrink-0 shadow-2xs">
                        {task.machine.machine_code}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Rute / Nama Toko */}
                  <div>
                    {isRelocation && task.store && task.target_store ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                          <span className="truncate max-w-[140px] text-slate-500 dark:text-slate-400 font-medium">
                            {task.store.name}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {task.target_store.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{task.target_store.address || task.store.address}</span>
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {displayStore ? displayStore.name : 'Outlet Mitra'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-start gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{displayStore?.address}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Waktu Selesai */}
                  {task.completed_at && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/80 w-fit">
                      <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Selesai pada:{' '}
                        {new Date(task.completed_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}

                  {/* Row 4: Action Footer (Klik untuk buka modal summary lengkap) */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Klik kartu untuk ringkasan</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSummaryTask(task);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Lihat Summary</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Execution Modal */}
      <BottomSheetModal
        item={activeTaskToExecute}
        onClose={() => setActiveTaskToExecute(null)}
      >
        {(task, close) => (
          <>
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
                onClick={close}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="font-extrabold text-slate-900 dark:text-white">
                {task.store?.name}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {task.store?.address}
              </div>
              {task.machine && (
                <div className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                  Unit: {task.machine.machine_code}
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
                onClick={close}
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
          </>
        )}
      </BottomSheetModal>

      {/* 1. Modal Pengangkutan Mesin ("Diangkut" -> in_progress atau kendala) */}
      <BottomSheetModal
        item={pickupTaskToExecute}
        onClose={() => {
          setPickupTaskToExecute(null);
          setHasPickupIssue(false);
        }}
      >
        {(task, close) => (
          <>
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
                onClick={close}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {task.store?.name}
                </span>
                {task.machine && (
                  <span className="text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                    {task.machine.machine_code}
                  </span>
                )}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {task.store?.address}
              </div>
            </div>

            {/* Camera Capture (Opsional) */}
            <CameraCapture
              label="Foto Bukti Pengangkutan (Opsional)"
              subLabel="Ambil foto mesin saat diangkut dari toko asal"
              required={false}
              onPhotoCaptured={({ base64 }) => setPickupPhotoBlob(base64)}
            />

            {/* Checkbox Memiliki Kendala */}
            <div className="pt-1">
              <label
                htmlFor="pickup-issue-checkbox"
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  hasPickupIssue
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  id="pickup-issue-checkbox"
                  checked={hasPickupIssue}
                  onChange={(e) => setHasPickupIssue(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className={`w-3.5 h-3.5 ${hasPickupIssue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-500'}`} />
                  <span>Memiliki kendala</span>
                </span>
              </label>
            </div>

            {/* Catatan Pengangkutan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {hasPickupIssue ? 'Deskripsi Kendala Pengangkutan (Wajib)' : 'Catatan Pengangkutan (Opsional)'}
              </label>
              <textarea
                rows={2}
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder={
                  hasPickupIssue
                    ? 'Jelaskan kendala di lokasi toko asal (misal: toko tutup, mesin rusak parah, akses terhalang)...'
                    : 'Misal: Mesin sudah dinaikkan ke armada pick-up, kondisi aman...'
                }
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>

            {/* Submit Action: "Berhasil diangkut" / "Laporkan kendala" */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              {hasPickupIssue ? (
                <button
                  type="button"
                  disabled={isSubmittingPickup}
                  onClick={handleReportPickupIssue}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/25 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPickup ? (
                    <span>Melaporkan...</span>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Laporkan kendala</span>
                    </>
                  )}
                </button>
              ) : (
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
              )}
            </div>
          </>
        )}
      </BottomSheetModal>

      {/* 2. Modal Pengiriman Mesin ("Dikirim" -> completed atau kendala) */}
      <BottomSheetModal
        item={deliveryTaskToExecute}
        onClose={() => {
          setDeliveryTaskToExecute(null);
          setHasDeliveryIssue(false);
        }}
      >
        {(task, close) => (
          <>
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
                onClick={close}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Summary */}
            <div className="bg-blue-50/60 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-950 dark:text-blue-200">
                  {task.target_store?.name || task.store?.name}
                </span>
                {task.machine && (
                  <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                    {task.machine.machine_code}
                  </span>
                )}
              </div>
              <div className="text-blue-800/80 dark:text-blue-300">
                {task.target_store?.address || task.store?.address}
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
                  inputMode="numeric"
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

            {/* Kolom Jumlah Koin yang Dititipkan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Jumlah Koin yang Dititipkan
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 absolute left-3 top-3 text-amber-500" />
                <input
                  type="number"
                  inputMode="numeric"
                  value={deliveryCoinAmount}
                  onChange={(e) => setDeliveryCoinAmount(e.target.value)}
                  placeholder="Misal: 500"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Catat jumlah koin modal awal yang diserahterimakan ke toko tujuan.
              </span>
            </div>

            {/* Kolom Uang Listrik (Default 75.000) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Uang Listrik (Rp)
              </label>
              <div className="relative">
                <Zap className="w-4 h-4 absolute left-3 top-3 text-amber-500" />
                <input
                  type="number"
                  inputMode="numeric"
                  value={deliveryElectricityFee}
                  onChange={(e) => setDeliveryElectricityFee(e.target.value)}
                  placeholder="75000"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Biaya kompensasi listrik toko (default Rp 75.000).
              </span>
            </div>

            {/* Checkbox Memiliki Kendala */}
            <div className="pt-1">
              <label
                htmlFor="delivery-issue-checkbox"
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  hasDeliveryIssue
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  id="delivery-issue-checkbox"
                  checked={hasDeliveryIssue}
                  onChange={(e) => setHasDeliveryIssue(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className={`w-3.5 h-3.5 ${hasDeliveryIssue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-500'}`} />
                  <span>Memiliki kendala</span>
                </span>
              </label>
            </div>

            {/* Catatan Penempatan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {hasDeliveryIssue ? 'Deskripsi Kendala Penempatan (Wajib)' : 'Catatan Penempatan (Opsional)'}
              </label>
              <textarea
                rows={2}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder={
                  hasDeliveryIssue
                    ? 'Jelaskan kendala di toko tujuan (misal: toko tutup, pemilik menolak, arus listrik bermasalah)...'
                    : 'Misal: Sudah ditest colok listrik & koin berjalan lancar...'
                }
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Submit Action: "Selesaikan tugas" / "Laporkan kendala" */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              {hasDeliveryIssue ? (
                <button
                  type="button"
                  disabled={isSubmittingDelivery}
                  onClick={handleReportDeliveryIssue}
                  className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/25 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingDelivery ? (
                    <span>Melaporkan...</span>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Laporkan kendala</span>
                    </>
                  )}
                </button>
              ) : (
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
              )}
            </div>
          </>
        )}
      </BottomSheetModal>

      {/* 3. Modal Ringkasan Tugas Selesai ("Berhasil dipindah" -> Summary Lengkap) */}
      <BottomSheetModal
        item={summaryTask}
        onClose={() => setSummaryTask(null)}
      >
        {(task, close) => {
          const isReloc = task.task_type === 'relokasi_mesin';
          const badge = getTaskBadge(task.task_type);

          return (
            <>
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {isReloc ? 'Ringkasan Relokasi Mesin' : `Ringkasan: ${badge.label}`}
                    </h3>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      Tugas Berhasil Diselesaikan
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Change Timeline Banner */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Waktu Tugas Dibuat:
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {new Date(task.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {task.completed_at && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] font-bold pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Status Berubah Selesai:
                    </span>
                    <span>
                      {new Date(task.completed_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Machine Badge jika ada */}
              {task.machine && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-500 font-bold">Unit Mesin:</span>
                  <span className="font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600">
                    {task.machine.machine_code}
                  </span>
                </div>
              )}

              {/* Content Berdasarkan Tipe Tugas */}
              {isReloc ? (
                /* Timeline Relokasi 2 Tahap */
                <div className="space-y-4 pt-1">
                  {/* Step 1: Diangkut (Toko Asal) */}
                  <div className="relative pl-6 border-l-2 border-slate-300 dark:border-slate-700 space-y-2">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 text-[9px] font-black">
                      1
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        Tahap 1: Diangkut (Toko Asal)
                      </span>
                      {task.pickup_at && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(task.pickup_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {task.store?.name || 'Toko Asal'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {task.store?.address}
                      </div>

                      {/* Catatan Pengangkutan (Opsional - hanya muncul jika diisi) */}
                      {task.pickup_notes && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <strong>Catatan Pengangkutan:</strong> {task.pickup_notes}
                        </div>
                      )}

                      {/* Foto Pengangkutan (Opsional - gambar thumbnail preview jika ada) */}
                      {task.pickup_photo_url ? (
                        <div className="space-y-1.5 pt-1">
                          <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            <img
                              src={task.pickup_photo_url}
                              alt="Foto Pengangkutan"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <a
                            href={task.pickup_photo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Buka Foto Resolusi Penuh
                          </a>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">
                          (Tidak menyertakan foto pengangkutan)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Dikirim & Selesai (Toko Tujuan) */}
                  <div className="relative pl-6 border-l-2 border-emerald-500 space-y-2">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-black">
                      2
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        Tahap 2: Selesai Dikirim & Ditempatkan
                      </span>
                      {task.completed_at && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(task.completed_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {task.target_store?.name || task.store?.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {task.target_store?.address || task.store?.address}
                      </div>

                      {/* Kolom Opsional: Nomor Meteran Koin Terakhir */}
                      {task.last_coin_meter != null && (
                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                            Meteran Koin Terakhir:
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {task.last_coin_meter.toLocaleString('id-ID')} koin
                          </span>
                        </div>
                      )}

                      {/* Kolom Opsional: Koin Dititipkan & Uang Listrik */}
                      {(task.coin_amount != null || task.electricity_fee != null) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Coins className="w-3 h-3 text-amber-500" />
                              Koin Dititipkan:
                            </span>
                            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                              {task.coin_amount != null
                                ? `${task.coin_amount.toLocaleString('id-ID')} koin`
                                : '0 koin'}
                            </p>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-500" />
                              Uang Listrik:
                            </span>
                            <p className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                              Rp {Number(task.electricity_fee ?? 75000).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Catatan Penempatan (Opsional - hanya jika diisi) */}
                      {task.delivery_notes && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <strong>Catatan Penempatan:</strong> {task.delivery_notes}
                        </div>
                      )}

                      {/* Foto Bukti Penempatan (Opsional - preview gambar thumbnail jika ada) */}
                      {task.photo_evidence_url ? (
                        <div className="space-y-1.5 pt-1">
                          <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800">
                            <img
                              src={task.photo_evidence_url}
                              alt="Foto Penempatan"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <a
                            href={task.photo_evidence_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Buka Foto Resolusi Penuh
                          </a>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">
                          (Tidak menyertakan foto penempatan)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Non-Relocation Summary Card */
                <div className="text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {task.store?.name || 'Toko Mitra'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {task.store?.address}
                  </div>

                  {/* Catatan jika diisi */}
                  {task.notes && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <strong>Catatan Petugas:</strong> {task.notes}
                    </div>
                  )}

                  {/* Foto Bukti Lapangan */}
                  {task.photo_evidence_url && (
                    <div className="space-y-1.5 pt-1">
                      <div className="w-full h-40 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <img
                          src={task.photo_evidence_url}
                          alt="Foto Bukti Lapangan"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <a
                        href={task.photo_evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Buka Foto Resolusi Penuh
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={close}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs cursor-pointer transition active:scale-98"
              >
                Tutup Ringkasan
              </button>
            </>
          );
        }}
      </BottomSheetModal>



      {/* Modal Informasi Lengkap Tugas Logistik (Fullscreen dengan Slide-Up & Slide-Down) */}
      <BottomSheetModal
        item={selectedTaskForDetail}
        onClose={() => setSelectedTaskForDetail(null)}
        isFullscreen={true}
      >
        {(t, close) => {
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
            <>
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
                  onClick={close}
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs cursor-pointer active:scale-98 transition shadow-md"
                >
                  Tutup Informasi
                </button>
              </div>
            </div>
          </>
        );
      }}
    </BottomSheetModal>
  </div>
);
};
