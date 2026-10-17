import React, { useState } from 'react';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import { Building2, ChevronDown, Globe, Check, MapPin } from 'lucide-react';

export const BranchSelector: React.FC = () => {
  const { profile } = useAuth();
  const { currentBranch, availableBranches, isGlobalView, setCurrentBranch, setGlobalView } = useBranch();
  const [isOpen, setIsOpen] = useState(false);

  if (!profile) return null;

  const canSwitchBranch = profile.role === 'owner' || profile.role === 'branch_manager';

  // If single branch staff, render clean static badge
  if (!canSwitchBranch) {
    return (
      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        <MapPin className="w-3 h-3 text-indigo-500 flex-shrink-0" />
        <span className="truncate max-w-[190px]">
          {currentBranch ? currentBranch.name : 'Cabang Utama'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
        title="Klik untuk ganti cabang aktif"
      >
        {isGlobalView ? (
          <Globe className="w-3 h-3 text-indigo-500 flex-shrink-0" />
        ) : (
          <Building2 className="w-3 h-3 text-indigo-500 flex-shrink-0" />
        )}
        <span className="truncate max-w-[140px]">
          {isGlobalView ? 'Semua Cabang' : currentBranch?.name || 'Pilih Cabang'}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
              {profile.role === 'owner' ? 'Cakupan Cabang (Owner)' : 'Cabang Ditugaskan (BM)'}
            </div>

            {/* Option: Global View (Owner Only) */}
            {profile.role === 'owner' && (
              <button
                type="button"
                onClick={() => {
                  setGlobalView();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                  isGlobalView
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Semua Cabang (Global)</span>
                </div>
                {isGlobalView && <Check className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* List of Available Branches */}
            <div className="space-y-0.5 mt-0.5 max-h-48 overflow-y-auto">
              {availableBranches.map((branch) => {
                const isSelected = !isGlobalView && currentBranch?.id === branch.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => {
                      setCurrentBranch(branch);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="truncate">
                        <div className="truncate">{branch.name}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                          {branch.code} • {branch.city}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
