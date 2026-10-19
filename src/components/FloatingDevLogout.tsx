import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ActionPromptModal } from './ActionPromptModal';
import { LogOut, GripVertical } from 'lucide-react';

export const FloatingDevLogout: React.FC = () => {
  const { logout, profile } = useAuth();

  // Floating Position (Default bottom-right on mobile)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(16, window.innerWidth - 160),
        y: Math.max(16, window.innerHeight - 130),
      };
    }
    return { x: 200, y: 500 };
  });

  const isDraggingRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Keep button within screen bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const btnWidth = buttonRef.current?.offsetWidth || 140;
        const btnHeight = buttonRef.current?.offsetHeight || 44;
        return {
          x: Math.min(Math.max(8, prev.x), window.innerWidth - btnWidth - 8),
          y: Math.min(Math.max(8, prev.y), window.innerHeight - btnHeight - 8),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!profile) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left clicks or touch
    if (e.button !== 0) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { x: position.x, y: position.y };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;

    if (Math.hypot(dx, dy) > 5) {
      hasMovedRef.current = true;
    }

    const btnWidth = buttonRef.current?.offsetWidth || 140;
    const btnHeight = buttonRef.current?.offsetHeight || 44;

    const newX = Math.min(
      Math.max(8, startPosRef.current.x + dx),
      window.innerWidth - btnWidth - 8
    );
    const newY = Math.min(
      Math.max(8, startPosRef.current.y + dy),
      window.innerHeight - btnHeight - 8
    );

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // If pointer didn't move significantly, treat as click to Logout
    if (!hasMovedRef.current) {
      handleLogout();
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  return (
    <>
      <div
      ref={buttonRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      className="fixed z-50 select-none cursor-grab active:cursor-grabbing group transition-transform active:scale-95"
      title="Geser bebas ke mana saja • Klik untuk keluar (Khusus Dev)"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-600/90 hover:bg-rose-600 dark:bg-rose-500/90 dark:hover:bg-rose-500 text-white shadow-xl shadow-rose-900/30 backdrop-blur-md border border-rose-300/40 text-xs font-black tracking-tight">
        <GripVertical className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 flex-shrink-0" />
        <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="whitespace-nowrap">Keluar (Dev)</span>
      </div>
    </div>

    {/* Modal Konfirmasi Logout Dev */}
    <ActionPromptModal
      config={
        showLogoutConfirm
          ? {
              type: 'confirm',
              variant: 'danger',
              title: 'Konfirmasi Keluar (Dev)',
              subtitle: profile ? `${profile.full_name || profile.username}` : undefined,
              message: 'Keluar dari sesi akun saat ini dan kembali ke menu login?',
              confirmLabel: 'Ya, Keluar',
              cancelLabel: 'Batal',
              onConfirm: () => {
                setShowLogoutConfirm(false);
                logout();
              },
            }
          : null
      }
      onClose={() => setShowLogoutConfirm(false)}
    />
  </>
  );
};
