import React, { useState, useEffect } from 'react';
import { BottomSheetModal } from './BottomSheetModal';
import { AlertTriangle, AlertCircle, HelpCircle, LogOut, X } from 'lucide-react';

export interface ActionPromptConfig {
  type: 'confirm' | 'prompt';
  variant?: 'danger' | 'warning' | 'primary';
  title: string;
  subtitle?: string;
  message?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (inputValue?: string) => void;
  onCancel?: () => void;
}

interface ActionPromptModalProps {
  config: ActionPromptConfig | null;
  onClose: () => void;
}

export const ActionPromptModal: React.FC<ActionPromptModalProps> = ({ config, onClose }) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (config) {
      setInputValue(config.initialValue || '');
    } else {
      setInputValue('');
    }
  }, [config]);

  return (
    <BottomSheetModal item={config} onClose={onClose}>
      {(item, close) => {
        const isDanger = item.variant === 'danger';
        const isWarning = item.variant === 'warning';

        const handleConfirm = () => {
          close();
          item.onConfirm(inputValue.trim());
        };

        const handleCancel = () => {
          close();
          if (item.onCancel) item.onCancel();
        };

        return (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${
                    isDanger
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : isWarning
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                  }`}
                >
                  {isDanger ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : item.title.toLowerCase().includes('keluar') || item.title.toLowerCase().includes('logout') ? (
                    <LogOut className="w-5 h-5" />
                  ) : (
                    <HelpCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {item.message && (
              <p className="text-sm text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                {item.message}
              </p>
            )}

            {item.type === 'prompt' && (
              <div className="space-y-1.5 pt-1">
                {item.inputLabel && (
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    {item.inputLabel}
                  </label>
                )}
                <textarea
                  rows={3}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={item.inputPlaceholder || 'Masukkan catatan di sini...'}
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none transition"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm text-center transition cursor-pointer active:scale-98"
              >
                {item.cancelLabel || 'Batal'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={item.type === 'prompt' && !inputValue.trim()}
                className={`flex-1 py-3.5 rounded-2xl font-bold text-sm text-center text-white transition cursor-pointer active:scale-98 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    : isWarning
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                }`}
              >
                {item.confirmLabel || 'Konfirmasi'}
              </button>
            </div>
          </>
        );
      }}
    </BottomSheetModal>
  );
};
