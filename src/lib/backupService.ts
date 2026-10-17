import { supabase } from './supabase';
import type { Branch, DroppingTransaction, DailyReconciliation, Machine, Store, DriverTask } from '../types';

export interface DailyBranchBackupSnapshot {
  export_version: string;
  generated_at: string;
  branch: Branch;
  date: string;
  summary: {
    total_transactions: number;
    total_gross_omset: number;
    total_store_share: number;
    total_net_deposit: number;
    total_machines_installed: number;
    total_active_stores: number;
  };
  droppings: DroppingTransaction[];
  reconciliations: DailyReconciliation[];
  machines: Machine[];
  stores: Store[];
  driver_tasks: DriverTask[];
}

export const generateBranchDailyBackupJson = async (
  branch: Branch,
  dateStr?: string
): Promise<DailyBranchBackupSnapshot> => {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  // 1. Fetch Droppings
  const { data: droppings } = await supabase
    .from('droppings')
    .select('*')
    .eq('branch_id', branch.id)
    .eq('transaction_date', targetDate);

  // 2. Fetch Reconciliations
  const { data: reconciliations } = await supabase
    .from('daily_reconciliations')
    .select('*')
    .eq('branch_id', branch.id)
    .eq('reconciliation_date', targetDate);

  // 3. Fetch Machines
  const { data: machines } = await supabase
    .from('machines')
    .select('*')
    .eq('branch_id', branch.id);

  // 4. Fetch Stores
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('branch_id', branch.id);

  // 5. Fetch Driver Tasks
  const { data: driverTasks } = await supabase
    .from('driver_tasks')
    .select('*')
    .eq('branch_id', branch.id);

  const droppingList = (droppings as DroppingTransaction[]) || [];
  const reconciliationList = (reconciliations as DailyReconciliation[]) || [];
  const machineList = (machines as Machine[]) || [];
  const storeList = (stores as Store[]) || [];
  const taskList = (driverTasks as DriverTask[]) || [];

  const totalGross = droppingList.reduce((acc, d) => acc + (d.gross_omset || 0), 0);
  const totalShare = droppingList.reduce((acc, d) => acc + (d.store_share_amount || 0), 0);
  const totalNet = droppingList.reduce((acc, d) => acc + (d.net_deposit_amount || 0), 0);
  const installedCount = machineList.filter((m) => m.status === 'terpasang').length;
  const activeStoreCount = storeList.filter((s) => s.status === 'terpasang' || s.status === 'terkirim').length;

  const snapshot: DailyBranchBackupSnapshot = {
    export_version: '2.0.0-multibranch',
    generated_at: new Date().toISOString(),
    branch,
    date: targetDate,
    summary: {
      total_transactions: droppingList.length,
      total_gross_omset: totalGross,
      total_store_share: totalShare,
      total_net_deposit: totalNet,
      total_machines_installed: installedCount,
      total_active_stores: activeStoreCount,
    },
    droppings: droppingList,
    reconciliations: reconciliationList,
    machines: machineList,
    stores: storeList,
    driver_tasks: taskList,
  };

  return snapshot;
};

export const downloadBackupJsonFile = (snapshot: DailyBranchBackupSnapshot) => {
  const fileName = `backup_${snapshot.branch.code.toLowerCase()}_${snapshot.date}.json`;
  const jsonStr = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
