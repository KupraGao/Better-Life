export type TextBlock = { type: "paragraph" | "heading" | "bullet"; text: string };
export type RichDocument = { blocks: TextBlock[] };

export function readBlocks(value: unknown): TextBlock[] {
  if (!value || typeof value !== "object" || !("blocks" in value) || !Array.isArray(value.blocks)) return [];
  return value.blocks.filter((block): block is TextBlock =>
    block && typeof block.text === "string" && ["paragraph", "heading", "bullet"].includes(block.type)
  );
}

export function authorText(value: unknown) {
  return readBlocks(value).map(({ type, text }) => {
    if (type === "heading") return `## ${text}`;
    if (type === "bullet") return `- ${text}`;
    return text;
  }).join("\n");
}

export function parseText(input: string): RichDocument {
  const blocks: TextBlock[] = [];
  for (const line of input.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith("## ")) blocks.push({ type: "heading", text: text.slice(3) });
    else if (text.startsWith("- ")) blocks.push({ type: "bullet", text: text.slice(2) });
    else blocks.push({ type: "paragraph", text });
  }
  return { blocks };
}

type Video = { videoSource: "YOUTUBE" | "VIMEO"; videoRef: string };

export function parseVideo(input: string): Video | null {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  let id: string | null = null;
  switch (url.hostname) {
    case "youtu.be": id = url.pathname.slice(1); break;
    case "youtube.com":
    case "www.youtube.com":
    case "m.youtube.com":
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else id = /^\/(?:embed|shorts)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
      break;
    case "vimeo.com":
    case "www.vimeo.com":
    case "player.vimeo.com": {
      const ref = /^\/(?:video\/)?([1-9]\d{0,11})\/?$/.exec(url.pathname)?.[1];
      return ref ? { videoSource: "VIMEO", videoRef: ref } : null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? { videoSource: "YOUTUBE", videoRef: id } : null;
}

export function videoUrl(source: string | null, reference: string | null, embed = false) {
  if (!reference) return null;
  if (source === "YOUTUBE" && /^[\w-]{11}$/.test(reference)) {
    return embed ? `https://www.youtube-nocookie.com/embed/${reference}` : `https://youtu.be/${reference}`;
  }
  if (source === "VIMEO" && /^[1-9]\d{0,11}$/.test(reference)) {
    return embed ? `https://player.vimeo.com/video/${reference}` : `https://vimeo.com/${reference}`;
  }
  return null;
}
