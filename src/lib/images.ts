export function sniffImageType(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 4) return null;
  // JPEG starts with 0xFF 0xD8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  // PNG starts with 0x89 0x50 0x4E 0x47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  // WebP starts with 'RIFF' and has 'WEBP' at bytes 8-11
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export function getPublicAssetUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/storage/v1/object/public/shop-assets/${storagePath.replace(/^\/+/, "")}`;
}
