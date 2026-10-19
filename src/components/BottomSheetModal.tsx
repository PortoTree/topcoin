import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetModalProps<T> {
  item: T | null;
  onClose: () => void;
  children: (item: T, close: () => void) => React.ReactNode;
  maxWidthClass?: string;
}

export function BottomSheetModal<T>({
  item,
  onClose,
  children,
  maxWidthClass = 'sm:max-w-md',
}: BottomSheetModalProps<T>) {
  const [renderedItem, setRenderedItem] = useState<T | null>(item);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (item) {
      setRenderedItem(item);
      setIsClosing(false);
    } else if (renderedItem && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setRenderedItem(null);
        setIsClosing(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [item]);

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

  if (!renderedItem) return null;

  return createPortal(
    <div
      className={`fixed inset-0 !m-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 ${
        isClosing ? 'animate-backdrop-fade-out' : 'animate-backdrop-fade-in'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full ${maxWidthClass} bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 ${
          isClosing ? 'animate-sheet-slide-down' : 'animate-sheet-slide-up'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children(renderedItem, handleClose)}
      </div>
    </div>,
    document.body
  );
}
