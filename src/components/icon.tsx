import type { ReactNode } from "react";

const shapes = {
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  external: <><path d="M6 18 18 6M7 6h11v11" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3.5 9h17M3.5 15h17" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  user: <><circle cx="12" cy="8" r="3.3" /><path d="M4.5 20v-1.8c0-3 3.4-5 7.5-5s7.5 2 7.5 5V20" /></>,
  book: <><path d="M12 6.5C9.4 4.6 6.1 4.4 3 5v14c3.2-.6 6.4-.3 9 1.5 2.6-1.8 5.8-2.1 9-1.5V5c-3.1-.6-6.4-.4-9 1.5Zm0 0v14" /></>,
  cap: <><path d="m2 9 10-5 10 5-10 5-10-5Zm4 2.2V16c3.3 3.5 8.7 3.5 12 0v-4.8M22 9v6" /></>,
  play: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 8 5.5 4-5.5 4Z" /></>,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  phone: <path d="m7 3 2.5 5-2.1 1.9c1.4 3.3 3.1 5 6.5 6.6l1.9-2.1L21 17c-.6 3.2-2.4 4.8-5.5 3.8A23.5 23.5 0 0 1 3.2 8.5C2.2 5.4 3.9 3.7 7 3Z" />,
} satisfies Record<string, ReactNode>;

export function Icon({ name, size = 20 }: { name: keyof typeof shapes; size?: number }) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
