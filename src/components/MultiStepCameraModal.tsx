import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  ChevronUp,
  Trash2,
} from 'lucide-react';

export interface PhotoStepItem {
  key: string;
  label: string;
  subLabel: string;
  required?: boolean;
}

interface MultiStepCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: PhotoStepItem[];
  initialStepIndex?: number;
  initialPhotos?: Record<string, string | null>;
  onFinish: (photos: Record<string, string | null>) => void;
}

export const MultiStepCameraModal: React.FC<MultiStepCameraModalProps> = ({
  isOpen,
  onClose,
  steps,
  initialStepIndex = 0,
  initialPhotos = {},
  onFinish,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [currentIndex, setCurrentIndex] = useState(initialStepIndex);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string | null>>(initialPhotos);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDropupOpen, setIsDropupOpen] = useState(false);

  // Lock background scrolling completely when camera modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isOpen]);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialStepIndex);
      setCapturedPhotos(initialPhotos);
      setIsDropupOpen(false);
    }
  }, [isOpen, initialStepIndex]);

  // Clean stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startStream = async () => {
    setIsStartingCamera(true);
    setCameraError(null);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stopStream();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIsStartingCamera(false);
      } catch (err: any) {
        console.error('Camera error:', err);
        setIsStartingCamera(false);
        setCameraError(
          'Gagal mengakses sensor kamera. Pastikan izin kamera aktif pada pengaturan browser Anda.'
        );
      }
    } else {
      setIsStartingCamera(false);
      setCameraError('Kamera langsung (WebRTC) tidak didukung.');
    }
  };

  // Start stream when modal opens
  useEffect(() => {
    if (isOpen) {
      startStream();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStep = steps[currentIndex] || steps[0];
  const currentPhotoForStep = capturedPhotos[currentStep.key] || null;

  // Snap photo
  const handleSnap = () => {
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

    setCapturedPhotos((prev) => ({
      ...prev,
      [currentStep.key]: base64,
    }));
    setIsDropupOpen(false);
  };

  // Retake photo for current step
  const handleRetake = () => {
    setCapturedPhotos((prev) => ({
      ...prev,
      [currentStep.key]: null,
    }));
    // Re-verify stream is active or restart if lost
    if (streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    } else {
      startStream();
    }
  };

  // Navigate to step
  const handleGoToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentIndex(index);
      setIsDropupOpen(false);
      // Ensure video is playing when moving to an uncaptured step
      setTimeout(() => {
        if (streamRef.current && videoRef.current) {
          if (videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    }
  };

  // Complete and save to parent form
  const handleFinish = () => {
    stopStream();
    onFinish(capturedPhotos);
    onClose();
  };

  const hasAnyPhoto = Object.values(capturedPhotos).some((val) => Boolean(val));
  const isLastStep = currentIndex === steps.length - 1;

  // Icon helper per step using images from /public
  const getStepIcon = (key: string, idx: number, className = 'w-5 h-5') => {
    let src = '/boneka.png';
    let alt = 'Mesin Boneka';

    if (key === 'photoMachine' || idx === 0) {
      src = '/boneka.png';
      alt = 'Mesin Boneka';
    } else if (key === 'photoMachineNumber' || idx === 1) {
      src = '/nomor.png';
      alt = 'Nomor Mesin';
    } else if (key === 'photoCoin' || idx === 2) {
      src = '/coin.png';
      alt = 'Koin';
    } else {
      src = '/optional.png';
      alt = 'Opsional';
    }

    return (
      <img
        src={src}
        alt={alt}
        className={`${className} object-contain rounded-sm flex-shrink-0 drop-shadow-xs`}
      />
    );
  };

  const modalContent = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[999999] w-screen h-screen min-h-screen bg-slate-50 dark:bg-black flex flex-col justify-between p-3 select-none animate-in fade-in duration-150 overflow-hidden touch-none transition-colors">
      {/* 1. Header Bar: Bersih, tanpa tulisan 'Langkah' dan tanpa nomor */}
      <div className="flex items-center justify-between pt-2 px-1 z-30">
        <div>
          <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            {currentStep.label}
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">{currentStep.subLabel}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          className="p-2.5 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white border border-slate-300 dark:border-white/10 transition active:scale-95 cursor-pointer shadow-xs"
          title="Tutup Kamera"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Main Viewport (Video Stream ALWAYS mounted in background, covered by preview when captured) */}
      <div className="relative flex-1 my-2 rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-slate-300 dark:border-white/10 flex items-center justify-center shadow-inner">
        {/* Video Element is ALWAYS rendered so the video stream never detaches or unmounts */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${cameraError || isStartingCamera ? 'hidden' : 'block'}`}
        />

        {/* Live Viewfinder UI Overlays (Only visible when NOT in preview mode) */}
        {!currentPhotoForStep && !cameraError && !isStartingCamera && (
          <>
            <div className="absolute inset-4 bottom-16 border-2 border-dashed border-white/60 dark:border-white/40 rounded-2xl pointer-events-none" />
            
            {/* Status Indicator Kiri Atas */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE VIEWFINDER
            </div>
          </>
        )}

        {/* Loading / Starting Indicator */}
        {!currentPhotoForStep && isStartingCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center space-y-2 z-10">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-medium">Mengaktifkan kamera...</p>
          </div>
        )}

        {/* Camera Error Message */}
        {!currentPhotoForStep && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center space-y-3 z-10">
            <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
            <button
              type="button"
              onClick={() => startStream()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Coba Ulang
            </button>
          </div>
        )}

        {/* Preview of Captured Photo Overlay (renders on top of video when photo is taken) */}
        {currentPhotoForStep && (
          <div className="absolute inset-0 z-20 w-full h-full flex items-center justify-center bg-black">
            <img
              src={currentPhotoForStep}
              alt={currentStep.label}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-500/80 backdrop-blur-md text-[11px] font-black text-white flex items-center gap-1.5 shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Preview Tersimpan</span>
            </div>

            {/* Icon Sampah di Kanan Bawah di Dalam Preview */}
            <button
              type="button"
              onClick={handleRetake}
              className="absolute bottom-14 right-3.5 p-2.5 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white backdrop-blur-md shadow-xl transition active:scale-90 cursor-pointer border border-white/40 z-10"
              title="Hapus foto ini"
              aria-label="Hapus foto ini"
            >
              <Trash2 className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Dropup Menu & Full-Frame Badge: HANYA MUNCUL SAAT TIDAK SEDANG PREVIEW FOTO */}
        {/* Dropup Menu Popup saat Badge Diklik (Bisa dibuka baik saat Kamera maupun Preview) */}
        {isDropupOpen && (
          <div className="absolute bottom-14 inset-x-2 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/20 rounded-2xl p-2 shadow-2xl animate-in slide-in-from-bottom-3 duration-150 space-y-1">
            <div className="px-2 py-1 text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
              <span>Pilih Mode Foto yang Ingin Diambil:</span>
              <X className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white" onClick={() => setIsDropupOpen(false)} />
            </div>
            {steps.map((st, idx) => {
              const isActive = idx === currentIndex;
              const isDone = Boolean(capturedPhotos[st.key]);
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => handleGoToStep(idx)}
                  className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-black shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getStepIcon(st.key, idx, 'w-7 h-7')}
                    <div>
                      <div className="text-xs">{st.label}</div>
                      <div className="text-[10px] opacity-75">{st.subLabel}</div>
                    </div>
                  </div>
                  {isDone && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40'
                    }`}>
                      <Check className="w-3 h-3" /> Terisi
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Full-Frame Badge di Bagian Paling Bawah Frame (Tampil baik di Kamera maupun Preview) */}
        <div className="absolute bottom-0 inset-x-0 z-30">
          <button
            type="button"
            onClick={() => setIsDropupOpen(!isDropupOpen)}
            className="w-full py-2.5 px-4 bg-white/95 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-900 backdrop-blur-md border-t border-slate-200 dark:border-white/20 text-slate-900 dark:text-white flex items-center justify-between text-xs font-bold transition active:bg-slate-200 dark:active:bg-slate-800 cursor-pointer shadow-2xl"
          >
            <div className="flex items-center gap-2.5">
              {getStepIcon(currentStep.key, currentIndex, 'w-6 h-6')}
              <span className="text-[11px] text-slate-700 dark:text-slate-200">
                Mode: <strong className="text-indigo-600 dark:text-indigo-300 font-black">{currentStep.label}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-white/10 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-transparent">
              <span>Ganti</span>
              <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropupOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* 3. Bottom Controls (Hanya Shutter & Tombol Batal/Selesai) */}
      <div className="pt-1 pb-1 px-2 z-30 space-y-2">
        {currentPhotoForStep ? (
          /* State saat foto sudah dipotret (Preview State) */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={() => handleGoToStep(currentIndex - 1)}
                  className="py-3 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer border border-slate-300 dark:border-transparent"
                  title="Foto Sebelumnya"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => handleGoToStep(currentIndex + 1)}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <span>Lanjut: {steps[currentIndex + 1]?.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 text-center py-2">
                  ✓ Semua foto telah selesai
                </div>
              )}
            </div>

            {/* 2 Kolom: [Foto Ulang] di kiri & [Simpan & Selesai] di kanan */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer flex-shrink-0"
              >
                <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Foto Ulang</span>
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Simpan & Selesai ({Object.values(capturedPhotos).filter(Boolean).length})</span>
              </button>
            </div>
          </div>
        ) : (
          /* State saat memotret (Shutter Controls Bersih) */
          <div className="flex items-center justify-center relative py-1">
            {/* Tombol Shutter Jepret Foto Bulat Besar di Tengah */}
            <button
              type="button"
              disabled={isStartingCamera || Boolean(cameraError)}
              onClick={handleSnap}
              className="w-19 h-19 rounded-full border-4 border-slate-900 dark:border-white flex items-center justify-center p-1.5 active:scale-90 transition cursor-pointer shadow-2xl disabled:opacity-50"
              title="Ambil Foto"
            >
              <div className="w-full h-full rounded-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-inner" />
            </button>

            {/* Tombol Selesai / Batal di Samping Kanan */}
            <div className="absolute right-2">
              {hasAnyPhoto ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-4 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-black transition active:scale-95 cursor-pointer shadow-xs"
                >
                  Selesai
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    stopStream();
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-transparent text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
