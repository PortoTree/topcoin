import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, CheckCircle2, X, ShieldCheck, Lock, Trash2 } from 'lucide-react';
import { compressImage } from '../lib/imageCompression';
import { toast } from '../context/ToastContext';
import { useMobileBackHandler } from '../hooks/useMobileBackHandler';

interface CameraCaptureProps {
  label: string;
  subLabel?: string;
  onPhotoCaptured: (data: { base64: string; blob: Blob }) => void;
  onPhotoRemoved?: () => void;
  required?: boolean;
  frameOrientation?: 'portrait' | 'landscape' | 'auto';
  embedded?: boolean;
  hasError?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  label,
  subLabel,
  onPhotoCaptured,
  onPhotoRemoved,
  required = true,
  frameOrientation = 'auto',
  embedded = false,
  hasError = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hardwareInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isPermissionPromptOpen, setIsPermissionPromptOpen] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const facingMode: 'environment' = 'environment';

  const isLandscape =
    frameOrientation === 'landscape' ||
    (frameOrientation !== 'portrait' &&
      (label.toLowerCase().includes('nota') || label.toLowerCase().includes('kuitansi')));

  // Navigasi Back bawaan HP: tutup modal kamera langsung
  useMobileBackHandler({
    enabled: isCameraModalOpen || isPermissionPromptOpen,
    onBack: () => {
      closeCamera();
    },
  });

  // Lock background scrolling completely when camera modal is active
  useEffect(() => {
    if (isCameraModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isCameraModalOpen]);

  // Stop camera stream cleanly
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const closeCamera = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    stopStream();
    setIsCameraModalOpen(false);
    setIsPermissionPromptOpen(false);
    setIsStartingCamera(false);
    setCameraError(null);
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  // Request camera permission and start stream
  const requestCameraAccess = async (targetFacing: 'environment' | 'user' = facingMode) => {
    setIsPermissionPromptOpen(false);
    setIsCameraModalOpen(true);
    setIsStartingCamera(true);
    setCameraError(null);

    // Check if getUserMedia is actually supported (Requires HTTPS or localhost)
    const isGetUserMediaSupported = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (isGetUserMediaSupported && (window.isSecureContext || window.location.hostname === 'localhost')) {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback tanpa constraint width/height ideal jika device tidak mendukung
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: targetFacing } },
            audio: false,
          });
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { });
        }
        setIsStartingCamera(false);
      } catch (err: any) {
        console.error('Camera stream error:', err);
        setIsStartingCamera(false);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError(
            'Izin kamera belum diberikan. Mohon klik "Izinkan" saat browser meminta izin kamera, atau aktifkan izin kamera pada pengaturan situs browser.'
          );
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('Perangkat kamera fisik tidak ditemukan pada perangkat ini.');
        } else {
          setCameraError(
            err.message || 'Kamera sedang digunakan aplikasi lain atau gagal terhubung. Silakan gunakan tombol kamera bawaan di bawah ini.'
          );
        }
      }
    } else {
      setIsStartingCamera(false);
      setIsCameraModalOpen(false);
      setIsPermissionPromptOpen(false);
      hardwareInputRef.current?.click();
    }
  };

  // Click on "Buka Kamera Langsung"
  const handleClickCamera = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If not secure context (plain HTTP on mobile IP), immediately open hardware camera directly (zero confusion, zero blocking modal)
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      hardwareInputRef.current?.click();
      return;
    }

    // Check if permission query is supported on secure contexts
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            requestCameraAccess(facingMode);
          } else {
            setIsPermissionPromptOpen(true);
          }
        })
        .catch(() => {
          requestCameraAccess(facingMode);
        });
    } else {
      requestCameraAccess(facingMode);
    }
  };

  // Snap photo from the live video frame directly into WebP (zero gallery, zero reload)
  const handleSnapPhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!videoRef.current) return;

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    const base64 = canvas.toDataURL('image/webp', 0.8);

    canvas.toBlob((blob) => {
      if (blob) {
        setPreviewUrl(base64);
        onPhotoCaptured({ base64, blob });
      }
      closeCamera();
    }, 'image/webp', 0.8);
  };

  // Fallback handler for direct hardware camera input (strictly capture="environment", NO GALLERY)
  const handleHardwareCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { base64, blob } = await compressImage(file, 1200, 1200, 0.75);
      setPreviewUrl(base64);
      onPhotoCaptured({ base64, blob });
    } catch (err) {
      console.error('Error compressing image:', err);
      toast.error('Gagal memproses foto dari kamera. Coba ulangi.');
    } finally {
      if (hardwareInputRef.current) hardwareInputRef.current.value = '';
    }
  };

  // Handler to remove captured photo
  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    if (hardwareInputRef.current) {
      hardwareInputRef.current.value = '';
    }
    if (onPhotoRemoved) {
      onPhotoRemoved();
    }
  };

  return (
    <div
      className={
        embedded
          ? hasError && !previewUrl
            ? 'space-y-2 p-2.5 rounded-2xl border border-rose-400 dark:border-rose-500/80'
            : 'space-y-2'
          : hasError && !previewUrl
            ? 'bg-white dark:bg-slate-900/60 border border-rose-400 dark:border-rose-500/80 rounded-2xl p-3.5 shadow-xs transition-colors duration-200'
            : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs transition-colors duration-200'
      }
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            {label}
            {required && <span className="text-rose-500">*</span>}
          </span>
          {subLabel && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subLabel}</p>}
        </div>
        {previewUrl && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Tersimpan
          </span>
        )}
      </div>

      {/* Hidden strictly hardware camera input (forces native camera sensor, strictly no gallery) */}
      <input
        ref={hardwareInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleHardwareCapture}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black aspect-video max-h-48 flex items-center justify-center">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {onPhotoRemoved && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                title="Hapus Foto"
                aria-label="Hapus Foto"
                className="p-1.5 bg-rose-600/90 backdrop-blur-md hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center shadow-lg active:scale-90 transition cursor-pointer border border-white/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClickCamera}
              className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Ambil Ulang Foto
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClickCamera}
          className="w-full py-4 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl flex flex-col items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
            Buka Kamera Langsung
          </span>
        </button>
      )}

      {/* Interactive Permission Request Prompt Dialog */}
      {isPermissionPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Camera className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Izin Akses Kamera Diperlukan
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed font-medium">
                Untuk menjaga keaslian data (Anti-Fraud), aplikasi TopCoin mewajibkan pengambilan foto langsung melalui kamera fisik di toko.
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-left flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-300 font-semibold leading-normal">
                Ketuk tombol di bawah, lalu pilih <strong>"Izinkan"</strong> pada jendela konfirmasi browser Anda.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => requestCameraAccess(facingMode)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Izinkan & Buka Kamera</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPermissionPromptOpen(false)}
                className="w-full py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Live Camera Modal via Portal */}
      {isCameraModalOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[999999] w-screen h-screen min-h-screen bg-slate-50 dark:bg-black flex flex-col justify-between p-3 select-none animate-in fade-in duration-150 overflow-hidden touch-none transition-colors">
            {/* Header Bar */}
            <div className="flex items-center justify-between pt-2 px-1 z-30">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  {label}
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {subLabel || 'Kamera Langsung Lapangan'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCamera}
                className="p-2.5 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white border border-slate-300 dark:border-white/10 transition active:scale-95 cursor-pointer shadow-xs"
                title="Tutup Kamera"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Viewfinder Feed */}
            <div className="relative flex-1 my-2 rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-slate-300 dark:border-white/10 flex items-center justify-center shadow-inner">
              {cameraError ? (
                <div className="p-6 text-center max-w-xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Akses Kamera Terblokir</h4>
                  <p className="text-xs text-rose-200 font-medium leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => requestCameraAccess(facingMode)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Minta Izin Ulang
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeCamera();
                        hardwareInputRef.current?.click();
                      }}
                      className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Gunakan Kamera Hardware Bawaan
                    </button>
                  </div>
                </div>
              ) : isStartingCamera ? (
                <div className="text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">Mengaktifkan kamera...</p>
                </div>
              ) : null}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraError || isStartingCamera ? 'hidden' : 'block'}`}
              />

              {/* Viewfinder Target Guidelines */}
              {!cameraError && !isStartingCamera && (
                <>
                  {isLandscape ? (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] aspect-[4/3] border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                      <span className="text-[10px] font-bold text-emerald-300 bg-black/60 px-2.5 py-1 rounded-full border border-emerald-500/30 backdrop-blur-xs">
                        Posisikan Nota di Sini
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-8 border-2 border-dashed border-white/40 rounded-2xl pointer-events-none" />
                  )}

                  <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE CAMERA
                  </div>
                </>
              )}
            </div>

            {/* Bottom Shutter Controls */}
            <div className="pt-1 pb-1 px-2 z-30 space-y-2">
              {!cameraError && (
                <div className="flex items-center justify-center relative py-1">
                  {/* Shutter Button (Snapshot live frame) */}
                  <button
                    type="button"
                    disabled={isStartingCamera}
                    onClick={handleSnapPhoto}
                    className="w-19 h-19 rounded-full border-4 border-slate-900 dark:border-white flex items-center justify-center p-1.5 active:scale-90 transition cursor-pointer shadow-2xl disabled:opacity-50"
                    title="Ambil Foto Sekarang"
                  >
                    <div className="w-full h-full rounded-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-inner" />
                  </button>

                  {/* Cancel Button */}
                  <div className="absolute right-2">
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-transparent text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
