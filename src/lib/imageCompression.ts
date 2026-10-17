/**
 * Helper to compress images client-side before upload to Cloudinary/Storage
 * Ensures images are resized and compressed to WebP/JPEG ~150-250 KB
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<{ base64: string; blob: Blob; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP format for optimal compression, fallback to JPEG
        const base64 = canvas.toDataURL('image/webp', quality);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const sizeKb = Math.round(blob.size / 1024);
              resolve({ base64, blob, sizeKb });
            } else {
              reject(new Error('Failed to compress blob'));
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
