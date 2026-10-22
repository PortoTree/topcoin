import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { BottomSheetModal } from '../../components/BottomSheetModal';

interface MyHistoryModalProps {
  userId: string;
  onClose: () => void;
}

export const MyHistoryModal: React.FC<MyHistoryModalProps> = ({ userId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'dropping' | 'marketing' | 'driver'>('attendance');
  const [attendances, setAttendances] = useState<any[]>([]);
  const [droppings, setDroppings] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Attendances
      const { data: attData } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', userId)
        .order('work_date', { ascending: false })
        .limit(30);

      if (attData) setAttendances(attData);

      // 2. Fetch Droppings
      const { data: dropData } = await supabase
        .from('droppings')
        .select(`*, store:stores(name), machine:machines(machine_code)`)
        .eq('dropping_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (dropData) setDroppings(dropData);

      // 3. Fetch Marketing (Stores registered by this user)
      const { data: storeData } = await supabase
        .from('stores')
        .select(`*, machine:machines(machine_code)`)
        .eq('sales_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (storeData) setStores(storeData);

      // 4. Fetch Driver Deliveries
      const { data: delivData } = await supabase
        .from('stores')
        .select(`*, machine:machines(machine_code)`)
        .eq('kurir_id', userId)
        .order('delivered_at', { ascending: false })
        .limit(30);

      if (delivData) setDeliveries(delivData);
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  return (
    <BottomSheetModal isOpen={true} onClose={onClose} maxWidthClass="max-w-[480px]">
      {(_, close) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Riwayat Lengkap Saya</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">Seluruh tugas & log absensi Anda</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        {/* Sub Tabs */}
        <div className="flex border border-slate-200 dark:border-slate-800 p-1.5 overflow-x-auto no-scrollbar gap-1 bg-slate-50 dark:bg-slate-950/40 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Absensi ({attendances.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dropping')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'dropping'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Dropping ({droppings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('marketing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'marketing'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Marketing ({stores.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('driver')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'driver'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Logistik ({deliveries.length})
          </button>
        </div>

        {/* Content List */}
        <div className="max-h-[58vh] overflow-y-auto space-y-2.5 pr-1 -mr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Memuat data riwayat...</span>
            </div>
          ) : activeTab === 'attendance' ? (
            attendances.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">Belum ada riwayat absensi.</p>
            ) : (
              attendances.map((a) => (
                <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      {a.work_date}
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Check-in: {new Date(a.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                    {a.role === 'sales' || a.role === 'marketing' ? 'Marketing' : a.role === 'kurir' || a.role === 'driver' || a.role === 'logistik' ? 'Logistik' : 'Dropping'}
                  </span>
                </div>
              ))
            )
          ) : activeTab === 'dropping' ? (
            droppings.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">Belum ada riwayat dropping omset.</p>
            ) : (
              droppings.map((d) => (
                <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{d.store?.name}</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {d.transaction_date} • Mesin: {d.machine?.machine_code}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      Setor: {formatIDR(Number(d.net_deposit_amount))}
                    </span>
                  </div>
                </div>
              ))
            )
          ) : activeTab === 'marketing' ? (
            stores.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">Belum ada riwayat toko yang didaftarkan.</p>
            ) : (
              stores.map((s) => (
                <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{s.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.address}</p>
                </div>
              ))
            )
          ) : (
            deliveries.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">Belum ada riwayat pengantaran mesin.</p>
            ) : (
              deliveries.map((del) => (
                <div key={del.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs">
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{del.name}</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {del.machine?.machine_code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Selesai diantar: {del.delivered_at ? new Date(del.delivered_at).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>
              ))
            )
          )}
        </div>
        </>
      )}
    </BottomSheetModal>
  );
};
