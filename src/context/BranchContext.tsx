import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Branch } from '../types';

interface BranchContextType {
  currentBranch: Branch | null;
  availableBranches: Branch[];
  isGlobalView: boolean;
  isLoadingBranches: boolean;
  setCurrentBranch: (branch: Branch | null) => void;
  setGlobalView: () => void;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const LOCAL_STORAGE_BRANCH_KEY = 'topcoin_selected_branch_id';

// Fallback dummy branches in case Supabase schema/tables are not yet migrated
const FALLBACK_BRANCHES: Branch[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    code: 'SBY-01',
    name: 'Cabang Surabaya Pusat',
    city: 'Surabaya',
    address: 'Jl. Basuki Rahmat No. 10',
    phone: '081234567890',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    code: 'MLG-01',
    name: 'Cabang Malang Kota',
    city: 'Malang',
    address: 'Jl. Ijen No. 25',
    phone: '081234567891',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);
  const [isGlobalView, setIsGlobalView] = useState<boolean>(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(true);

  const fetchBranches = useCallback(async () => {
    if (!profile) {
      setAvailableBranches([]);
      setCurrentBranchState(null);
      setIsGlobalView(false);
      setIsLoadingBranches(false);
      return;
    }

    setIsLoadingBranches(true);
    try {
      let branches: Branch[] = [];

      // 1. OWNER: Access to ALL branches
      if (profile.role === 'owner') {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          branches = data as Branch[];
        } else {
          branches = FALLBACK_BRANCHES;
        }

        setAvailableBranches(branches);

        // Check stored selection
        const storedId = localStorage.getItem(LOCAL_STORAGE_BRANCH_KEY);
        if (storedId === 'global' || storedId === 'all') {
          setIsGlobalView(true);
          setCurrentBranchState(null);
        } else if (storedId) {
          const matched = branches.find((b) => b.id === storedId);
          if (matched) {
            setCurrentBranchState(matched);
            setIsGlobalView(false);
          } else {
            // Default to Global for Owner
            setIsGlobalView(true);
            setCurrentBranchState(null);
          }
        } else {
          // Default to Global for Owner
          setIsGlobalView(true);
          setCurrentBranchState(null);
        }
      }
      // 2. BRANCH MANAGER: Access to Assigned Branches
      else if (profile.role === 'branch_manager') {
        // Query assignments
        const { data: assignments, error: assignErr } = await supabase
          .from('branch_manager_assignments')
          .select('branch:branches(*)')
          .eq('branch_manager_id', profile.id);

        if (!assignErr && assignments && assignments.length > 0) {
          branches = assignments
            .map((a: any) => a.branch)
            .filter((b: any) => Boolean(b) && b.is_active);
        }

        // Fallback if table not populated yet
        if (branches.length === 0) {
          branches = FALLBACK_BRANCHES;
        }

        setAvailableBranches(branches);

        // Restore selection or pick first assigned
        const storedId = localStorage.getItem(LOCAL_STORAGE_BRANCH_KEY);
        const matched = branches.find((b) => b.id === storedId);
        if (matched) {
          setCurrentBranchState(matched);
        } else if (branches.length > 0) {
          setCurrentBranchState(branches[0]);
        }
        setIsGlobalView(false);
      }
      // 3. ADMIN CABANG, MARKETING, DROPPING, DRIVER: Bound strictly to single branch_id
      else {
        const targetBranchId = profile.branch_id || FALLBACK_BRANCHES[0].id;
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', targetBranchId)
          .maybeSingle();

        if (!error && data) {
          branches = [data as Branch];
          setCurrentBranchState(data as Branch);
        } else {
          // Fallback to first branch matching profile
          const matchedFallback = FALLBACK_BRANCHES.find((b) => b.id === profile.branch_id) || FALLBACK_BRANCHES[0];
          branches = [matchedFallback];
          setCurrentBranchState(matchedFallback);
        }

        setAvailableBranches(branches);
        setIsGlobalView(false);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
      setAvailableBranches(FALLBACK_BRANCHES);
      setCurrentBranchState(FALLBACK_BRANCHES[0]);
      setIsGlobalView(false);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [profile?.id, profile?.role, profile?.branch_id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const setCurrentBranch = (branch: Branch | null) => {
    if (branch === null) {
      // Switch to Global view (only allowed for Owner)
      if (profile?.role === 'owner') {
        setIsGlobalView(true);
        setCurrentBranchState(null);
        localStorage.setItem(LOCAL_STORAGE_BRANCH_KEY, 'global');
      }
    } else {
      setIsGlobalView(false);
      setCurrentBranchState(branch);
      localStorage.setItem(LOCAL_STORAGE_BRANCH_KEY, branch.id);
    }
  };

  const setGlobalView = () => {
    if (profile?.role === 'owner') {
      setIsGlobalView(true);
      setCurrentBranchState(null);
      localStorage.setItem(LOCAL_STORAGE_BRANCH_KEY, 'global');
    }
  };

  const refreshBranches = async () => {
    await fetchBranches();
  };

  return (
    <BranchContext.Provider
      value={{
        currentBranch,
        availableBranches,
        isGlobalView,
        isLoadingBranches,
        setCurrentBranch,
        setGlobalView,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
