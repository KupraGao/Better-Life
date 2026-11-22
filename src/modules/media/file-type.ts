export const maxAssetSize = 768 * 1024;
type AssetType = { mimeType: string; kind: "IMAGE" | "ATTACHMENT" };

export function detectAsset(bytes: Uint8Array, name: string): AssetType | null {
  if (!bytes.length || bytes.length > maxAssetSize) return null;
  const header = Buffer.from(bytes.subarray(0, 8));
  if (header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && /\.png$/i.test(name))
    return { mimeType: "image/png", kind: "IMAGE" };
  if (header[0] === 255 && header[1] === 216 && header[2] === 255 && /\.jpe?g$/i.test(name))
    return { mimeType: "image/jpeg", kind: "IMAGE" };
  if (header.toString("ascii").startsWith("%PDF-") && /\.pdf$/i.test(name))
    return { mimeType: "application/pdf", kind: "ATTACHMENT" };
  if (/\.txt$/i.test(name) && !bytes.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return { mimeType: "text/plain; charset=utf-8", kind: "ATTACHMENT" };
    } catch { return null; }
  }
  return null;
}
