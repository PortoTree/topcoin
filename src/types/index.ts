// Role-Based Access Control
export type UserRole = 
  | 'owner' 
  | 'branch_manager' 
  | 'admin_cabang' 
  | 'marketing' 
  | 'dropping' 
  | 'logistik'
  // Legacy aliases for backward compatibility during phased migration
  | 'driver'
  | 'admin'
  | 'sales'
  | 'kurir';

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchManagerAssignment {
  id: string;
  branch_manager_id: string;
  branch_id: string;
  assigned_at: string;
  branch?: Branch;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  email?: string | null;
  pin?: string;
  auth_provider?: 'pin' | 'google';
  branch_id?: string | null;
  assigned_task?: 'logistik' | 'marketing' | 'dropping' | 'admin_cabang' | 'driver' | null;
  is_active: boolean;
  deletion_status?: 'active' | 'pending_deletion';
  deletion_requested_by?: string | null;
  deletion_requested_at?: string | null;
  created_at: string;
  updated_at?: string;
  branch?: Branch;
}

export interface Attendance {
  id: string;
  user_id: string;
  work_date: string;
  role: UserRole;
  check_in_time: string;
  created_at: string;
}

export type MachineStatus = 'gudang' | 'dikirim' | 'terpasang' | 'maintenance';

export interface Machine {
  id: string;
  branch_id?: string;
  machine_code: string;
  current_store_id: string | null;
  status: MachineStatus;
  last_counter_meter?: number;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  branch?: Branch;
  store?: Store;
}

export type StoreStatus = 'proses' | 'dikirim' | 'terpasang' | 'terkirim' | 'nonaktif';

export interface Store {
  id: string;
  branch_id?: string;
  name: string;
  address: string;
  owner_name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  status: StoreStatus;
  current_machine_id: string | null;
  sales_id?: string | null;
  kurir_id?: string | null;
  marketing_id?: string | null;
  photo_store_url: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  branch?: Branch;
  machine?: Machine;
  sales?: UserProfile;
  kurir?: UserProfile;
  marketing?: UserProfile;
}

export type LogistikTaskType = 'relokasi_mesin' | 'opsional' | 'pasang_baru' | 'tarik_rusak' | 'antar_koin';
export type DriverTaskType = LogistikTaskType;
export type DriverTaskStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'kendala';

export interface DriverTask {
  id: string;
  branch_id: string;
  task_type: LogistikTaskType;
  driver_id: string;
  officer_ids?: string[];
  assigned_by: string;
  store_id?: string | null;
  target_store_id?: string | null;
  machine_id?: string | null;
  coin_amount?: number;
  status: DriverTaskStatus;
  photo_evidence_url?: string | null;
  notes?: string | null;
  completed_at?: string | null;
  created_at: string;
  // Relocation tracking
  pickup_photo_url?: string | null;
  pickup_notes?: string | null;
  pickup_at?: string | null;
  last_coin_meter?: number | null;
  electricity_fee?: number | null;
  delivery_notes?: string | null;
  // Joins
  branch?: Branch;
  driver?: UserProfile;
  assigned_by_user?: UserProfile;
  store?: Store;
  target_store?: Store;
  machine?: Machine;
}

export type LogistikTask = DriverTask;

export interface DroppingTransaction {
  id: string;
  branch_id?: string;
  dropping_user_id: string;
  store_id: string;
  machine_id: string;
  
  // Coin & Omset
  coins_collected?: number;
  coin_unit_value?: number;
  gross_omset: number;
  
  // Odometer / Meter
  previous_counter_meter?: number;
  calculated_new_meter?: number;
  actual_physical_meter?: number | null;
  meter_discrepancy?: number | null;
  discrepancy_reason?: string | null;
  
  // Store Share & Net
  store_share_amount?: number;
  store_cut_percentage?: number;
  store_cut_amount?: number;
  net_deposit_amount: number;
  
  // Photos (support both new and legacy names)
  photo_machine_meter_url?: string;
  photo_coin_tray_url?: string;
  photo_machine_url?: string;
  photo_machine_number_url?: string;
  photo_coin_url?: string;
  photo_nota_url?: string | null;
  photo_optional_url?: string | null;
  optional_notes?: string | null;
  photo_store_url?: string | null;
  has_omset?: boolean;
  
  latitude: number | null;
  longitude: number | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  
  // Joins
  branch?: Branch;
  store?: Store;
  machine?: Machine;
  dropping_user?: UserProfile;
}

export interface DailyReconciliation {
  id: string;
  branch_id?: string;
  reconciliation_date: string;
  dropping_user_id: string;
  system_total_net: number;
  physical_cash_received: number;
  difference_amount: number;
  status: 'matched' | 'unmatched' | 'pending';
  verified_by: string | null;
  notes: string | null;
  created_at: string;
  // Joins
  branch?: Branch;
  dropping_user?: UserProfile;
  verified_by_user?: UserProfile;
}

export interface DailyBranchBackup {
  id: string;
  branch_id: string;
  backup_date: string;
  file_path: string;
  total_records: number;
  total_omset: number;
  created_at: string;
  branch?: Branch;
}

export interface OfflineDroppingRecord {
  localId?: number;
  id?: string;
  branch_id?: string;
  dropping_user_id: string;
  store_id: string;
  store_name: string;
  machine_id: string;
  machine_code: string;
  coins_collected?: number;
  previous_counter_meter?: number;
  actual_physical_meter?: number | null;
  has_mismatch?: boolean;
  discrepancy_reason?: string | null;
  store_share_amount?: number;
  has_omset?: boolean;
  gross_omset?: number;
  store_cut_percentage?: number;
  photo_meter_blob?: Blob | string;
  photo_tray_blob?: Blob | string;
  photo_machine_blob?: Blob | string;
  photo_machine_number_blob?: Blob | string;
  photo_coin_blob?: Blob | string;
  photo_nota_blob?: Blob | string | null;
  photo_optional_blob?: Blob | string | null;
  optional_notes?: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  sync_status: 'pending' | 'uploading' | 'synced' | 'failed';
  error_message?: string;
}
