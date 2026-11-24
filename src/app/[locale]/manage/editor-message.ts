import type { Messages } from "@/i18n";

export function editorMessage(code: string, t: Messages["manage"]) {
  const notices: Record<string, string> = {
    saved: t.saved, removed: t.removed, replaced: t.replaced, invalid: t.invalid, denied: t.denied,
    stale: t.stale, duplicate: t.duplicate, publish: t.publishError, video: t.videoError,
    file: t.fileError, "file-size": t.fileSizeError, price: t.priceError, cover: t.coverError, category: t.categoryError,
  };
  return notices[code] ?? t.invalid;
}
