"use client";

import { LocaleStatus } from "@/components/locale-status";

export default function LocaleError({ reset }: { error: unknown; reset: () => void }) {
  return <LocaleStatus kind="error" onReset={reset} />;
}
