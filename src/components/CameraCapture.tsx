import React, { useRef, useState } from 'react';
import { Camera, RefreshCw, CheckCircle2 } from 'lucide-react';
import { compressImage } from '../lib/imageCompression';

interface CameraCaptureProps {
  label: string;
  subLabel?: string;
  onPhotoCaptured: (data: { base64: string; blob: Blob }) => void;
  required?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  label,
  subLabel,
  onPhotoCaptured,
  required = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      // Auto compress to ~150-250KB WebP
      const { base64, blob, sizeKb } = await compressImage(file, 1200, 1200, 0.75);
      setPreviewUrl(base64);
      setPhotoSizeKb(sizeKb);
      onPhotoCaptured({ base64, blob });
    } catch (err) {
      console.error('Error compressing image:', err);
      alert('Gagal memproses foto dari kamera. Coba ulangi.');
    } finally {
      setIsCompressing(false);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs transition-colors duration-200">
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
            Tersimpan ({photoSizeKb} KB)
          </span>
        )}
      </div>

      {/* Hidden file input with hardware camera constraint */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black aspect-video max-h-48 flex items-center justify-center">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={triggerCamera}
            className="absolute bottom-2 right-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg active:scale-95 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Foto Ulang
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={triggerCamera}
          disabled={isCompressing}
          className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex flex-col items-center justify-center gap-1.5 transition active:scale-[0.99] touch-target"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            {isCompressing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </div>
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
            {isCompressing ? 'Mengompres Foto...' : 'Buka Kamera Langsung'}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Hanya kamera perangkat (Anti-Fraud)
          </span>
        </button>
      )}
    </div>
  );
};
