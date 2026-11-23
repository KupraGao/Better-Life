export const courseLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type CourseLevelName = (typeof courseLevels)[number];

/** One lari is 100 tetri. 10_000_000 tetri is 100_000.00 GEL. */
export const maxPriceTetri = 10_000_000;

/** Empty input is null. An unusable amount is undefined. */
export function readGel(text: string) {
  const value = text.trim();
  if (!value) return null;
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) return undefined;
  const [whole, frac = ""] = value.split(".");
  const tetri = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isInteger(tetri) || tetri <= 0 || tetri > maxPriceTetri) return undefined;
  return tetri;
}

export function formatGel(tetri: number) {
  const whole = Math.trunc(tetri / 100);
  const frac = Math.abs(tetri % 100);
  return frac === 0 ? `${whole} GEL` : `${whole}.${String(frac).padStart(2, "0")} GEL`;
}

export function gelInput(tetri: number | null) {
  if (tetri === null) return "";
  const whole = Math.trunc(tetri / 100);
  const frac = Math.abs(tetri % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

/** Empty input clears the image. Anything other than an HTTPS URL is undefined. */
export function readCover(text: string) {
  const value = text.trim();
  if (!value) return null;
  if (value.length > 2000) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return undefined;
  return url.toString();
}

export function readLevel(text: string): CourseLevelName | null | undefined {
  if (!text) return null;
  return (courseLevels as readonly string[]).includes(text) ? text as CourseLevelName : undefined;
}

/** Keeps a valid slug unchanged and turns spaces or capitals into the same safe form. */
export function normalizeSlug(text: string) {
  const slug = text.trim().toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return undefined;
  return slug;
}
