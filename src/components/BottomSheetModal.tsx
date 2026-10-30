import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMobileBackHandler } from '../hooks/useMobileBackHandler';

interface BottomSheetModalProps<T = any> {
  item?: T | null;
  isOpen?: boolean;
  onClose: () => void;
  children: React.ReactNode | ((item: T, close: () => void) => React.ReactNode);
  maxWidthClass?: string;
  contentClassName?: string;
  isFullscreen?: boolean;
}

export function BottomSheetModal<T = any>({
  item,
  isOpen,
  onClose,
  children,
  maxWidthClass = 'sm:max-w-md',
  contentClassName,
  isFullscreen = false,
}: BottomSheetModalProps<T>) {
  // Normalize active trigger whether passed as item or boolean isOpen
  const activeTrigger = isOpen !== undefined ? (isOpen ? (true as unknown as T) : null) : item ?? null;
  const [renderedItem, setRenderedItem] = useState<T | null>(activeTrigger);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (activeTrigger) {
      setRenderedItem(activeTrigger);
      setIsClosing(false);
    } else if (renderedItem && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setRenderedItem(null);
        setIsClosing(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [activeTrigger]);

  // Lock background scrolling when sheet is open
  useEffect(() => {
    if (renderedItem) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [renderedItem]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setRenderedItem(null);
      setIsClosing(false);
    }, 220);
  };

  // Navigasi Back bawaan HP otomatis menutup modal
  useMobileBackHandler({
    enabled: Boolean(renderedItem),
    onBack: handleClose,
  });

  if (!renderedItem) return null;

  const content =
    typeof children === 'function'
      ? (children as (item: T, close: () => void) => React.ReactNode)(renderedItem, handleClose)
      : children;

  if (isFullscreen) {
    return createPortal(
      <div
        className={`fixed inset-0 !m-0 z-50 bg-white dark:bg-slate-950 flex flex-col overflow-hidden ${
          isClosing ? 'animate-sheet-slide-down' : 'animate-sheet-slide-up'
        }`}
      >
        {content}
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 !m-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 ${
        isClosing ? 'animate-backdrop-fade-out' : 'animate-backdrop-fade-in'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto ${
          contentClassName || ''
        } ${isClosing ? 'animate-sheet-slide-down' : 'animate-sheet-slide-up'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>,
    document.body
  );
}
