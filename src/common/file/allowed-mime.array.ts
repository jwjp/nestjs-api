import { extname } from 'path';

const ExtensionsByMimeType = new Map<string, string[]>([
  ['text/plain', ['.txt']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/gif', ['.gif']],
  ['video/mp4', ['.mp4']],
  ['video/mpeg', ['.mpeg', '.mpg']],
]);

export const MimeType: string[] = [...ExtensionsByMimeType.keys()];

/**
 * Multer reads multipart filenames as latin1, which garbles UTF-8 names such as
 * Korean ones
 */
export function decodeOriginalName(originalname: string): string {
  const decoded = Buffer.from(originalname, 'latin1').toString('utf8');
  return decoded.includes('�') ? originalname : decoded;
}

/**
 * The MIME type is client-supplied, so the stored extension must match it too
 */
export function isAllowedUpload(
  mimetype: string,
  originalname: string,
): boolean {
  const extensions = ExtensionsByMimeType.get(mimetype) ?? [];
  return extensions.includes(extname(originalname).toLowerCase());
}
