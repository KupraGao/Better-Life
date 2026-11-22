import { isLocale } from "@/i18n";
import { db } from "@/lib/db";
import { isId } from "@/modules/catalog/manage";
import { getCurrentUser } from "@/modules/identity/session";
import { readAsset } from "@/modules/media/read-asset";

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "ka";
  const missing = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!isId(assetId) || !isLocale(locale)) return missing();
  const actor = await getCurrentUser();
  const asset = await db.$transaction((tx) => readAsset(tx, assetId, locale, actor), { isolationLevel: "RepeatableRead" });
  if (!asset) return missing();
  const filename = encodeURIComponent(asset.name).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16));
  const disposition = asset.kind === "IMAGE" ? "inline" : "attachment";
  return new Response(new Uint8Array(asset.data), { headers: {
    "Content-Type": asset.mimeType,
    "Content-Length": String(asset.sizeBytes),
    "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
