export const CLOUDINARY_CONFIG = Object.freeze({
  cloudName: 'eaeuplpl',
  uploadPreset: 'colegio_fotos',
  folderRoot: 'colegio'
});

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

export async function uploadToCloudinary(file, folder = 'avisos') {
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Tipo de archivo no permitido. Usa imagen, PDF, DOCX o XLSX.');

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  body.append('folder', `${CLOUDINARY_CONFIG.folderRoot}/${folder}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
    method: 'POST', body
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Cloudinary rechazó la carga.');
  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format || '',
    bytes: result.bytes || file.size,
    nombre: file.name
  };
}

export async function checkCloudinaryAvailability() {
  const started = performance.now();
  const response = await fetch(`https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/q_auto,f_auto/Img/logo.png`, {
    method: 'HEAD', cache: 'no-store'
  }).catch(() => null);
  return { configured: true, reachable: Boolean(response), latency: Math.round(performance.now() - started) };
}
