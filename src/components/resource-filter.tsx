"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./resources.module.css";

const filters = ["resources", "courses", "books"] as const;
type Filter = (typeof filters)[number];
type Card = { id: string; kind: "courses" | "books"; href: string; content: ReactNode };

function filterFromHash(hash: string): Filter {
  if (hash === "#courses") return "courses";
  if (hash === "#books") return "books";
  return "resources";
}

export function ResourceFilter({ children, label, options, cards }: {
  children: ReactNode;
  label: string;
  options: Record<Filter, string>;
  cards: Card[];
}) {
  const [filter, setFilter] = useState<Filter>("resources");

  useEffect(() => {
    const applyHash = () => setFilter(filterFromHash(window.location.hash));
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
    };
  }, []);

  function choose(next: Filter) {
    setFilter(next);
    const url = new URL(window.location.href);
    url.hash = next;
    const scrollY = window.scrollY;
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    window.scrollTo(0, scrollY);
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  }

  const visible = cards.filter((item) => filter === "resources" || item.kind === filter);

  return (
    <>
      <div className={styles.heading}>
        {filters.map((id) => <span key={id} id={id} aria-hidden="true" className={styles.anchor} />)}
        <div>{children}</div>
        <div className={styles.filters} role="group" aria-label={label}>
          {filters.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              className={styles.filter}
              onClick={() => choose(id)}
            >
              {options[id]}
            </button>
          ))}
        </div>
      </div>
      <ul id="resource-list" className={styles.grid}>
        {visible.map((item) => <li key={item.id}>{item.content}</li>)}
      </ul>
    </>
  );
}
