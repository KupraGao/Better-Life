"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./resources.module.css";

const filters = ["resources", "courses", "books"] as const;
type Filter = (typeof filters)[number];
type Card = { kind: "courses" | "books"; href: string; content: ReactNode };

function currentFilter(): Filter {
  const hash = window.location.hash;
  if (hash === "#courses") return "courses";
  if (hash === "#books") return "books";
  return "resources";
}

function subscribeToLocation(update: () => void) {
  window.addEventListener("hashchange", update);
  window.addEventListener("popstate", update);
  return () => {
    window.removeEventListener("hashchange", update);
    window.removeEventListener("popstate", update);
  };
}

function defaultFilter(): Filter {
  return "resources";
}

export function ResourceFilter({ children, label, options, cards }: {
  children: ReactNode;
  label: string;
  options: Record<Filter, string>;
  cards: Card[];
}) {
  const filter = useSyncExternalStore(subscribeToLocation, currentFilter, defaultFilter);
  return (
    <>
      <div className={styles.heading}>
        {filters.map((id) => <span key={id} id={id} aria-hidden="true" className={styles.anchor} />)}
        <div>{children}</div>
        <nav className={styles.filters} aria-label={label}>
          {filters.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={filter === id ? "true" : undefined}
              aria-controls="resource-list"
              className={styles.filter}
            >
              {options[id]}
            </a>
          ))}
        </nav>
      </div>
      <ul id="resource-list" className={styles.grid}>
        {cards.filter((item) => filter === "resources" || item.kind === filter).map((item) => (
          <li key={item.href}>{item.content}</li>
        ))}
      </ul>
    </>
  );
}
