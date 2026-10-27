import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { getCurrentWorkDate } from '../../../lib/workCycle';
import type { Attendance } from '../../../types';
import { StaffAttendanceSectionMobile } from './StaffAttendanceSectionMobile';
import { StaffAttendanceSectionDesktop } from './StaffAttendanceSectionDesktop';

interface StaffAttendanceManagerProps {
  branchId?: string | null;
}

export const StaffAttendanceManager: React.FC<StaffAttendanceManagerProps> = ({ branchId }) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => getCurrentWorkDate());
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAttendances = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('attendances')
        .select(`
          id,
          user_id,
          work_date,
          role,
          check_in_time,
          created_at,
          user:profiles(id, full_name, username, role, phone, branch_id)
        `)
        .eq('work_date', selectedDate)
        .order('check_in_time', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching staff attendances:', error);
        setAttendances([]);
        return;
      }

      if (data) {
        let list = data as unknown as Attendance[];
        // Filter by branch if branchId is provided
        if (branchId) {
          list = list.filter((a) => !a.user?.branch_id || a.user.branch_id === branchId);
        }
        setAttendances(list);
      }
    } catch (err) {
      console.error('Fetch attendances error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, branchId]);

  useEffect(() => {
    fetchAttendances();
  }, [fetchAttendances]);

  return (
    <div>
      {/* Mobile Component */}
      <div className="block md:hidden">
        <StaffAttendanceSectionMobile
          attendances={attendances}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          isLoading={isLoading}
          onRefresh={fetchAttendances}
        />
      </div>

      {/* Desktop Component */}
      <div className="hidden md:block">
        <StaffAttendanceSectionDesktop
          attendances={attendances}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          isLoading={isLoading}
          onRefresh={fetchAttendances}
        />
      </div>
    </div>
  );
};
