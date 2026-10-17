import Dexie, { type Table } from 'dexie';
import type { OfflineDroppingRecord } from '../types';

export class DroppingOfflineDatabase extends Dexie {
  offlineDroppings!: Table<OfflineDroppingRecord, number>;

  constructor() {
    super('TopCoinDroppingDB');
    this.version(1).stores({
      offlineDroppings: '++localId, dropping_user_id, store_id, sync_status, created_at',
    });
  }
}

export const offlineDb = new DroppingOfflineDatabase();
