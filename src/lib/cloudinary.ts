/**
 * Cloudinary Direct Upload Helper
 * Uses unsigned upload preset for secure client-side uploads
 */
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const defaultUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'upload_optional';
const presetMachine = import.meta.env.VITE_CLOUDINARY_PRESET_MACHINE || 'upload_mechine';
const presetNota = import.meta.env.VITE_CLOUDINARY_PRESET_NOTA || 'upload_nota';
const presetStore = import.meta.env.VITE_CLOUDINARY_PRESET_STORE || 'upload_store';
const presetOptional = import.meta.env.VITE_CLOUDINARY_PRESET_OPTIONAL || 'upload_optional';

export function resolvePreset(folder: string): string {
  const f = folder.toLowerCase();
  if (f.includes('machine') || f.includes('mechine') || f.includes('coin')) {
    return presetMachine;
  }
  if (f.includes('nota')) {
    return presetNota;
  }
  if (f.includes('store')) {
    return presetStore;
  }
  return presetOptional || defaultUploadPreset;
}

export async function uploadToCloudinary(
  blobOrBase64: Blob | string,
  folder = 'topcoin_dropping',
  customPreset?: string
): Promise<string> {
  // If Cloudinary preset is demo or not configured, return base64 data url directly as fallback
  if (!cloudName || cloudName === 'demo') {
    if (typeof blobOrBase64 === 'string') {
      return blobOrBase64;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blobOrBase64);
    });
  }

  const selectedPreset = customPreset || resolvePreset(folder);

  const formData = new FormData();
  formData.append('file', blobOrBase64);
  formData.append('upload_preset', selectedPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gagal mengupload foto ke Cloudinary.');
  }

  const data = await response.json();
  return data.secure_url;
}
