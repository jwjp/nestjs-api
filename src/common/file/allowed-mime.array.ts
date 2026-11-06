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
 * The MIME type is client-supplied, so the stored extension must match it too
 */
export function isAllowedUpload(
  mimetype: string,
  originalname: string,
): boolean {
  const extensions = ExtensionsByMimeType.get(mimetype) ?? [];
  return extensions.includes(extname(originalname).toLowerCase());
}
