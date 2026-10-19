import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentWorkDate, DEFAULT_RESET_TIME, type ResetTimeConfig } from '../lib/workCycle';
import type { UserProfile, UserRole, Attendance } from '../types';

export const isManagementRole = (r?: UserRole | null): boolean => {
  if (!r) return false;
  return r === 'owner' || r === 'branch_manager' || r === 'admin_cabang' || r === 'admin';
};

interface AuthContextType {
  profile: UserProfile | null;
  role: UserRole | null;
  activeRole: UserRole | null;
  todayAttendance: Attendance | null;
  isLoading: boolean;
  loginWithPin: (identifier: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  checkInToday: (chosenRole?: 'dropping' | 'marketing' | 'logistik' | 'driver' | 'sales' | 'kurir') => Promise<{ success: boolean; message?: string }>;
  updateStaffRole: (
    userId: string,
    newRole: UserRole,
    assignedTask?: 'logistik' | 'driver' | 'marketing' | 'dropping' | 'admin_cabang' | null
  ) => Promise<{ success: boolean; message?: string }>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  refreshAttendance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'topcoin_cached_profile';
const LOCAL_STORAGE_ATTENDANCE_KEY = 'topcoin_cached_attendance';

// Default mock profiles for fast dev & testing without manual DB inserts
const DEMO_PROFILES: Record<string, Partial<UserProfile>> = {
  owner: {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'owner',
    full_name: 'Pak Hendra (Owner)',
    role: 'owner',
    phone: '08111111111',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  branch_manager: {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'bm',
    full_name: 'Pak Dimas (Branch Manager)',
    role: 'branch_manager',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08222222222',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  admin_cabang: {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'admin',
    full_name: 'Siti (Admin Cabang Surabaya)',
    role: 'admin_cabang',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08333333333',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'admin',
    full_name: 'Siti (Admin Cabang Surabaya)',
    role: 'admin_cabang',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08333333333',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  marketing: {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'marketing',
    full_name: 'Andi (Marketing Surabaya)',
    role: 'marketing',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08444444444',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  sales: {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'marketing',
    full_name: 'Andi (Marketing Surabaya)',
    role: 'marketing',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08444444444',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  dropping: {
    id: '55555555-5555-5555-5555-555555555555',
    username: 'dropping',
    full_name: 'Budi (Dropping Surabaya)',
    role: 'dropping',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08555555555',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  logistik: {
    id: '66666666-6666-6666-6666-666666666666',
    username: 'logistik',
    full_name: 'Dodi (Logistik Surabaya)',
    role: 'logistik',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08666666666',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  driver: {
    id: '66666666-6666-6666-6666-666666666666',
    username: 'logistik',
    full_name: 'Dodi (Logistik Surabaya)',
    role: 'logistik',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08666666666',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
  kurir: {
    id: '66666666-6666-6666-6666-666666666666',
    username: 'logistik',
    full_name: 'Dodi (Logistik Surabaya)',
    role: 'logistik',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    phone: '08666666666',
    pin: '123456',
    is_active: true,
    deletion_status: 'active',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(() => {
    const cachedProfileStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    const cachedAttStr = localStorage.getItem(LOCAL_STORAGE_ATTENDANCE_KEY);
    if (cachedAttStr && cachedProfileStr) {
      try {
        const cachedProfile: UserProfile = JSON.parse(cachedProfileStr);
        const att: Attendance = JSON.parse(cachedAttStr);
        const currentWorkDate = getCurrentWorkDate();
        if (att.user_id === cachedProfile.id && att.work_date === currentWorkDate) {
          return att;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [resetTimeConfig, setResetTimeConfig] = useState<ResetTimeConfig>(DEFAULT_RESET_TIME);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch Reset Time configuration from app_settings
  const fetchResetTimeConfig = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'system_reset_time')
        .maybeSingle();

      if (data?.value) {
        setResetTimeConfig(data.value);
      }
    } catch (e) {
      // fallback to DEFAULT_RESET_TIME
    }
  };

  // Fetch or verify today's attendance for the logged-in user
  const fetchTodayAttendance = async (userId: string, config: ResetTimeConfig) => {
    const workDate = getCurrentWorkDate(new Date(), config);
    try {
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_id', userId)
        .eq('work_date', workDate)
        .maybeSingle();

      if (!error && data) {
        setTodayAttendance(data as Attendance);
        localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(data));
      } else {
        setTodayAttendance(null);
        localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_KEY);
      }
    } catch (err) {
      console.error('Error fetching today attendance:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await fetchResetTimeConfig();

        if (profile) {
          // Verify profile from database
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .maybeSingle();

          if (dbProfile) {
            // Immediate lock check: If account is marked for deletion or inactive, log out immediately
            if (dbProfile.deletion_status === 'pending_deletion' || !dbProfile.is_active) {
              setProfile(null);
              setTodayAttendance(null);
              localStorage.removeItem(LOCAL_STORAGE_KEY);
              localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_KEY);
              return;
            }

            setProfile(dbProfile);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dbProfile));

            if (!isManagementRole(dbProfile.role)) {
              await fetchTodayAttendance(dbProfile.id, resetTimeConfig);
            }
          }
        }
      } catch (err) {
        console.error('Init auth error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [profile?.id]);

  // Periodic check for reset time rollover
  useEffect(() => {
    const checkResetInterval = setInterval(() => {
      if (profile && !isManagementRole(profile.role)) {
        const currentWorkDate = getCurrentWorkDate(new Date(), resetTimeConfig);
        if (todayAttendance && todayAttendance.work_date !== currentWorkDate) {
          // New work cycle has arrived! Reset attendance state to prompt new check-in
          setTodayAttendance(null);
          localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_KEY);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkResetInterval);
  }, [profile, todayAttendance, resetTimeConfig]);

  // Auto-sync staff profile role when Admin/BM reassigns it in the background
  useEffect(() => {
    if (!profile) return;

    const syncLatestProfile = async () => {
      try {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.id)
          .maybeSingle();

        if (
          dbProfile &&
          (dbProfile.role !== profile.role ||
            dbProfile.assigned_task !== profile.assigned_task ||
            !isManagementRole(dbProfile.role))
        ) {
          if (
            dbProfile.role !== profile.role ||
            dbProfile.assigned_task !== profile.assigned_task
          ) {
            setProfile(dbProfile);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dbProfile));
          }
          if (!isManagementRole(dbProfile.role)) {
            await fetchTodayAttendance(dbProfile.id, resetTimeConfig);
          }
        }
      } catch (e) {
        // ignore background sync errors
      }
    };

    window.addEventListener('focus', syncLatestProfile);
    const syncInterval = setInterval(syncLatestProfile, 5000); // Fast 5s background sync

    return () => {
      window.removeEventListener('focus', syncLatestProfile);
      clearInterval(syncInterval);
    };
  }, [profile?.id, profile?.role, profile?.assigned_task, resetTimeConfig]);

  const loginWithPin = async (identifier: string, pin: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const cleanIdentifier = identifier.trim().toLowerCase();
      const cleanPin = pin.trim();

      // Check DB
      const { data: matchedProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.eq.${cleanIdentifier},phone.eq.${cleanIdentifier},role.eq.${cleanIdentifier}`)
        .limit(1);

      let targetProfile: UserProfile | null = null;

      if (!profileError && matchedProfiles && matchedProfiles.length > 0) {
        targetProfile = matchedProfiles[0] as UserProfile;
      } else {
        // Fallback demo matching
        const demoKey = Object.keys(DEMO_PROFILES).find(
          (k) =>
            DEMO_PROFILES[k].username === cleanIdentifier ||
            DEMO_PROFILES[k].phone === cleanIdentifier ||
            DEMO_PROFILES[k].role === cleanIdentifier
        );
        if (demoKey) {
          targetProfile = {
            id: DEMO_PROFILES[demoKey].id || 'demo-user-id',
            username: DEMO_PROFILES[demoKey].username || cleanIdentifier,
            full_name: DEMO_PROFILES[demoKey].full_name || 'Demo User',
            role: DEMO_PROFILES[demoKey].role || (demoKey as UserRole),
            phone: DEMO_PROFILES[demoKey].phone || null,
            pin: DEMO_PROFILES[demoKey].pin || '123456',
            branch_id: DEMO_PROFILES[demoKey].branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            is_active: DEMO_PROFILES[demoKey].is_active ?? true,
            deletion_status: DEMO_PROFILES[demoKey].deletion_status || 'active',
            created_at: new Date().toISOString(),
          };
        }
      }

      if (!targetProfile) {
        return { success: false, message: 'Username atau No. HP tidak terdaftar.' };
      }

      // Check Account Locking (Hierarchical Deletion / Inactive Check)
      if (targetProfile.deletion_status === 'pending_deletion') {
        return {
          success: false,
          message: 'Akun Anda sedang dinonaktifkan (menunggu persetujuan Branch Manager). Akses masuk terkunci.',
        };
      }

      if (!targetProfile.is_active) {
        return {
          success: false,
          message: 'Akun Anda sedang dinonaktifkan. Hubungi Branch Manager atau Owner.',
        };
      }

      if (targetProfile.pin && targetProfile.pin !== cleanPin) {
        return { success: false, message: 'PIN yang Anda masukkan salah.' };
      }

      setProfile(targetProfile);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(targetProfile));

      // Clear any prior attendance cache to prevent cross-account contamination
      setTodayAttendance(null);
      localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_KEY);

      // If field worker, fetch attendance for today specifically for this targetProfile
      if (!isManagementRole(targetProfile.role)) {
        await fetchTodayAttendance(targetProfile.id, resetTimeConfig);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, message: err.message || 'Terjadi kesalahan saat login.' };
    } finally {
      setIsLoading(false);
    }
  };

  const checkInToday = async (
    customRole?: 'dropping' | 'marketing' | 'logistik' | 'driver' | 'sales' | 'kurir'
  ): Promise<{ success: boolean; message?: string }> => {
    if (!profile) return { success: false, message: 'Anda belum login.' };

    try {
      const workDate = getCurrentWorkDate(new Date(), resetTimeConfig);
      // Default directly to profile's assigned role from Admin/BM
      const roleToUse = customRole || profile.role;
      const normalizedRole: UserRole =
        roleToUse === 'sales'
          ? 'marketing'
          : roleToUse === 'kurir' || roleToUse === 'driver'
          ? 'logistik'
          : (roleToUse as UserRole);

      const { data, error } = await supabase
        .from('attendances')
        .upsert(
          {
            user_id: profile.id,
            work_date: workDate,
            role: normalizedRole,
            check_in_time: new Date().toISOString(),
          },
          { onConflict: 'user_id,work_date' }
        )
        .select()
        .single();

      if (error) {
        console.warn('DB attendance record fallback to memory:', error);
        // Fallback local memory attendance if table not created
        const mockAtt: Attendance = {
          id: 'att-' + Date.now(),
          user_id: profile.id,
          work_date: workDate,
          role: normalizedRole,
          check_in_time: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        setTodayAttendance(mockAtt);
        localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(mockAtt));
        return { success: true };
      }

      setTodayAttendance(data as Attendance);
      localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(data));

      return { success: true };
    } catch (err: any) {
      console.error('Check in error:', err);
      return { success: false, message: err.message || 'Gagal menyimpan absensi.' };
    }
  };

  // Admin Cabang / Branch Manager role reassignment handler
  const updateStaffRole = async (
    userId: string,
    newRole: UserRole,
    assignedTask?: 'logistik' | 'driver' | 'marketing' | 'dropping' | 'admin_cabang' | null
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const normalizedTargetRole: UserRole =
        newRole === 'sales' ? 'marketing' : newRole === 'kurir' || newRole === 'driver' ? 'logistik' : newRole;
      const normalizedAssignedTask =
        assignedTask === 'admin_cabang'
          ? null
          : assignedTask === 'driver'
          ? 'logistik'
          : assignedTask;

      // 1. Build payload
      const updatePayload: Record<string, any> = { role: normalizedTargetRole };
      if (assignedTask !== undefined) {
        updatePayload.assigned_task = normalizedAssignedTask;
      }

      // Update Supabase profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (profileErr) {
        console.warn('DB update staff role warning:', profileErr);
      }

      // 2. If this staff is the currently logged-in user, update profile state & storage immediately
      if (profile && profile.id === userId) {
        const updated = {
          ...profile,
          role: normalizedTargetRole,
          ...(assignedTask !== undefined
            ? { assigned_task: normalizedAssignedTask }
            : {}),
        };
        setProfile(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }

      // 3. If there is an active attendance today for this staff, update attendance role as well
      // so the staff layout shifts immediately without needing to wait for reset
      const workDate = getCurrentWorkDate(new Date(), resetTimeConfig);
      const normalizedRole: UserRole = normalizedTargetRole;

      await supabase
        .from('attendances')
        .update({ role: normalizedRole })
        .eq('user_id', userId)
        .eq('work_date', workDate);

      // If current user is this staff and already checked in today, update attendance in memory
      if (profile && profile.id === userId && todayAttendance) {
        const updatedAtt = { ...todayAttendance, role: normalizedRole };
        setTodayAttendance(updatedAtt);
        localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(updatedAtt));
      }

      return { success: true };
    } catch (err: any) {
      console.error('Update staff role error:', err);
      return { success: false, message: err.message || 'Gagal mengubah peran staf.' };
    }
  };

  const logout = async () => {
    setProfile(null);
    setTodayAttendance(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_KEY);
  };

  const switchDemoRole = async (targetRole: UserRole) => {
    setIsLoading(true);
    try {
      // Find in DB
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', targetRole)
        .limit(1)
        .maybeSingle();

      const chosenProfile: UserProfile =
        (data as UserProfile) ||
        ({
          id: DEMO_PROFILES[targetRole]?.id || '11111111-1111-1111-1111-111111111111',
          username: DEMO_PROFILES[targetRole]?.username || targetRole,
          full_name: DEMO_PROFILES[targetRole]?.full_name || `Demo ${targetRole}`,
          role: (DEMO_PROFILES[targetRole]?.role as UserRole) || targetRole,
          phone: DEMO_PROFILES[targetRole]?.phone || null,
          pin: '123456',
          branch_id: DEMO_PROFILES[targetRole]?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          is_active: true,
          deletion_status: 'active',
          created_at: new Date().toISOString(),
        } as UserProfile);

      setProfile(chosenProfile);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(chosenProfile));

      if (!isManagementRole(chosenProfile.role)) {
        // Auto create or fetch today attendance for smooth field testing
        const workDate = getCurrentWorkDate(new Date(), resetTimeConfig);
        const chosenFieldRole =
          chosenProfile.role === 'marketing' || chosenProfile.role === 'sales'
            ? 'marketing'
            : chosenProfile.role === 'logistik' || chosenProfile.role === 'driver' || chosenProfile.role === 'kurir'
            ? 'logistik'
            : 'dropping';

        const mockAtt: Attendance = {
          id: 'demo-att-' + Date.now(),
          user_id: chosenProfile.id,
          work_date: workDate,
          role: chosenFieldRole,
          check_in_time: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        setTodayAttendance(mockAtt);
        localStorage.setItem(LOCAL_STORAGE_ATTENDANCE_KEY, JSON.stringify(mockAtt));
      } else {
        setTodayAttendance(null);
        localStorage.removeItem(LOCAL_STORAGE_ATTENDANCE_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAttendance = async () => {
    if (profile && !isManagementRole(profile.role)) {
      await fetchTodayAttendance(profile.id, resetTimeConfig);
    }
  };

  // Determine active operating role:
  // - Management roles: activeRole is strictly profile.role (immediate dashboard access)
  // - Field workers: activeRole is todayAttendance.role (or null if not yet checked in)
  const activeRole: UserRole | null = isManagementRole(profile?.role)
    ? profile!.role
    : todayAttendance
    ? todayAttendance.role
    : null;

  return (
    <AuthContext.Provider
      value={{
        profile,
        role: profile?.role || null,
        activeRole,
        todayAttendance,
        isLoading,
        loginWithPin,
        logout,
        checkInToday,
        updateStaffRole,
        switchDemoRole,
        refreshAttendance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
