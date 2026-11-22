import { Fragment, type ReactNode } from "react";
import { readBlocks, videoUrl } from "./content";

export function RichText({ value }: { value: unknown }) {
  const elements: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  function flushBullets() {
    if (bullets.length) elements.push(<ul key={`list-${elements.length}`}>{bullets}</ul>);
    bullets = [];
  }
  for (const block of readBlocks(value)) {
    if (block.type === "bullet") {
      bullets.push(<li key={bullets.length}>{block.text}</li>);
      continue;
    }
    flushBullets();
    const Element = block.type === "heading" ? "h3" : "p";
    elements.push(<Element key={elements.length}>{block.text}</Element>);
  }
  flushBullets();
  return <Fragment>{elements}</Fragment>;
}

export function LessonVideo({ source, reference, title = "Video" }: {
  source: string | null; reference: string | null; title?: string;
}) {
  const url = videoUrl(source, reference, true);
  return url ? <iframe
    src={url} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
    allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen
    style={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: 0 }}
  /> : null;
}
