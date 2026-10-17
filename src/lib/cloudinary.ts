/**
 * Cloudinary Direct Upload Helper
 * Uses unsigned upload preset for secure client-side uploads
 */
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export async function uploadToCloudinary(
  blobOrBase64: Blob | string,
  folder = 'topcoin_dropping'
): Promise<string> {
  // If Cloudinary preset is demo or not configured, return base64 data url directly as fallback
  if (!cloudName || cloudName === 'demo' || !uploadPreset || uploadPreset === 'demo') {
    if (typeof blobOrBase64 === 'string') {
      return blobOrBase64;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blobOrBase64);
    });
  }

  const formData = new FormData();
  formData.append('file', blobOrBase64);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

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
